// 1. 서울시 25개 구 행정경계 불러오기
var korea = ee.FeatureCollection(
  "projects/future-name-405308/assets/LARD_ADM_SECT_SGG_11_202505"
);

// --- 행정코드-영문 구역명 매핑 (EE Dictionary 사용) ---
var codeToEnglishNameMapping = {
  11110: "Jongno-gu",
  11140: "Jung-gu",
  11170: "Yongsan-gu",
  11200: "Seongdong-gu",
  11215: "Gwangjin-gu",
  11230: "Dongdaemun-gu",
  11260: "Jungnang-gu",
  11290: "Seongbuk-gu",
  11305: "Gangbuk-gu",
  11320: "Dobong-gu",
  11350: "Nowon-gu",
  11380: "Eunpyeong-gu",
  11410: "Seodaemun-gu",
  11440: "Mapo-gu",
  11470: "Yangcheon-gu",
  11500: "Gangseo-gu",
  11530: "Guro-gu",
  11545: "Geumcheon-gu",
  11560: "Yeongdeungpo-gu",
  11590: "Dongjak-gu",
  11620: "Gwanak-gu",
  11650: "Seocho-gu",
  11680: "Gangnam-gu",
  11710: "Songpa-gu",
  11740: "Gangdong-gu",
};
var eeCodeToEnglishNameMapping = ee.Dictionary(codeToEnglishNameMapping);

// FeatureCollection에 'ENG_NAME' 속성 추가
var koreaWithEnglish = korea.map(function (feature) {
  var admCode = ee.String(feature.get("ADM_SECT_C"));
  var engName = eeCodeToEnglishNameMapping.get(admCode, "Unknown");
  return feature.set("ENG_NAME", engName);
});

// --- Landsat 8 (C2 T1 L2) 품질 밴드 (QA_PIXEL)를 이용한 마스킹 함수 ---
// QA_PIXEL 밴드 설명: https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C02_T1_L2#bands
function maskL8Clouds(image) {
  var qa = image.select("QA_PIXEL");

  // QA_PIXEL 비트 마스크:
  // Bit 1: Dilated Cloud (0 = No, 1 = Yes)
  // Bit 3: Cloud (0 = No, 1 = Yes)
  // Bit 4: Cloud Shadow (0 = No, 1 = Yes)
  // Bit 5: Snow (0 = No, 1 = Yes)

  // 마스킹할 플래그: 구름, 구름 그림자, 눈, 희미한 구름 (Dilated Cloud)
  var cloudDilated = qa.bitwiseAnd(1 << 1).neq(0); // Bit 1
  var cloud = qa.bitwiseAnd(1 << 3).neq(0); // Bit 3
  var cloudShadow = qa.bitwiseAnd(1 << 4).neq(0); // Bit 4
  var snow = qa.bitwiseAnd(1 << 5).neq(0); // Bit 5

  var mask = cloudDilated
    .not()
    .and(cloud.not())
    .and(cloudShadow.not())
    .and(snow.not());

  // L2 컬렉션에는 'CLOUD_COVER' 속성 대신 'CLOUD_COVER_LAND'가 있을 수 있습니다.
  // 또는 필터링을 'CLOUD_COVER_LAND'로 변경해야 할 수 있습니다.
  // 여기서는 CLOUD_COVER를 유지하되, 오류가 발생하면 변경을 고려하세요.
  return image
    .updateMask(mask)
    .copyProperties(image, ["system:time_start", "CLOUD_COVER_LAND"]);
}

// ----------------------------------------------------

// 분석할 연도 리스트
var years = ee.List.sequence(2020, 2024);

// 모든 연도의 결과를 저장할 빈 FeatureCollection
var allYearsStats = ee.FeatureCollection([]);

// ** --- 핵심 조절 변수: NDVI 임계값 --- **
var NDVI_THRESHOLD = 0.6; // Sentinel-2와 동일한 실제 NDVI 값 사용 (0.8)

// 각 연도별로 루프를 돌며 녹지 면적 계산
years.evaluate(
  function (yearList) {
    yearList.forEach(function (year) {
      year = ee.Number(year);

      // Landsat 8 이미지 컬렉션 불러오기: LC08/C02/T1_L2 (Level-2 Surface Reflectance)
      var l8 = ee
        .ImageCollection("LANDSAT/LC08/C02/T1_L2") // <-- 컬렉션 ID 변경
        .filterDate(ee.Date.fromYMD(year, 5, 1), ee.Date.fromYMD(year, 8, 31))
        .filterBounds(koreaWithEnglish)
        .filter(ee.Filter.lt("CLOUD_COVER_LAND", 30)) // <-- 속성 이름 변경 가능성 (CLOUD_COVER_LAND)
        .map(maskL8Clouds)
        .filter(ee.Filter.neq("system:index", null))
        .select(["SR_B4", "SR_B5"]); // <-- 밴드 이름 변경 (SR_B4, SR_B5)
      // .median(); // median()은 이미지 컬렉션에 적용되므로, select 후에 적용

      // Landsat은 이미지 컬렉션에서 단일 이미지로 만들 때 median()을 적용하는 것이 좋습니다.
      // 마스킹된 이미지 컬렉션이 빈 경우 오류가 발생할 수 있으므로,
      // 이를 처리하기 위해 or(imageCollection.first()) 등을 고려할 수 있지만,
      // 여기서는 일단 .median()을 직접 적용합니다.
      var l8_median = l8.median();

      // Landsat SR 밴드는 스케일링 팩터가 0.0000275, 오프셋 -0.2가 있으므로, 먼저 실제 SR 값으로 변환해야 합니다.
      var l8_scaled = l8_median.multiply(0.0000275).add(-0.2);
      var ndvi = l8_scaled
        .normalizedDifference(["SR_B5", "SR_B4"])
        .rename("NDVI"); // <-- 밴드 이름 변경

      // NDVI 임계값 적용
      var greenAreaBinary = ndvi.gte(NDVI_THRESHOLD);

      // 픽셀 면적 계산 (Landsat 30m x 30m = 900㎡)
      var pixelAreaSqM = ee.Number(30).pow(2);

      // 구별 녹지 면적 합산
      var stats = greenAreaBinary.reduceRegions({
        collection: koreaWithEnglish,
        reducer: ee.Reducer.sum(),
        scale: 30, // Landsat 해상도에 맞춰 스케일 변경
        crs: "EPSG:32652",
        tileScale: 4,
      });

      // 결과 FeatureCollection 가공: 필요한 컬럼만 선택하고 연도 추가
      var yearStats = stats.map(function (f) {
        var numGreenPixels = ee.Number(f.get("sum"));
        var greenAreaM2 = numGreenPixels.multiply(pixelAreaSqM);
        return ee.Feature(null, {
          code: f.get("ADM_SECT_C"),
          name_eng: f.get("ENG_NAME"),
          area_m2: greenAreaM2,
          year: year,
        });
      });

      allYearsStats = allYearsStats.merge(yearStats);
    });

    print(
      "2020-2024 통합 구별 녹지 면적 (㎡) - Landsat 8 C2 T1 L2:",
      allYearsStats
    );

    Export.table.toDrive({
      collection: allYearsStats,
      description: "Landsat_NDVI_GreenArea_Seoul_2020_2024",
      folder: "GEE_Exports",
      fileNamePrefix:
        "Landsat_GreenArea_Seoul_2020_2024_NDVI_" + NDVI_THRESHOLD,
      fileFormat: "CSV",
      selectors: ["code", "name_eng", "area_m2", "year"],
    });
  },
  function (error) {
    print("Error processing years:", error);
  }
);
