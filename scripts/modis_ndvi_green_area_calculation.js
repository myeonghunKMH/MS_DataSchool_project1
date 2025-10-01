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

// --- MODIS 품질 밴드 (QA)를 이용한 마스킹 함수 ---
// MOD13Q1 QA 밴드에 대한 설명: https://lpdaac.usgs.gov/documents/103/MOD13_UserGuide_V6.pdf (p.23)
function maskModisClouds(image) {
  var qa = image.select("DetailedQA");

  // QA 비트 마스크:
  // Bit 0-1: MODLAND_QA (00 = Good data)
  // Bit 2-5: VI_Quality (0000 = Good data, use with confidence)
  // Bit 6-7: Cloud_State (00 = clear, 01 = cloudy, 10 = mixed, 11 = not set)
  // Bit 8-9: Land/Water Flag (00 = shallow ocean, 01 = land, 10 = deep ocean, 11 = shallow inland water)
  // Bit 10-12: Aerosol_Quantity (000 = climatology, 001 = low, 010 = average, 011 = high)

  // 목표: 'Good data'이고 'Clear'인 픽셀만 사용
  var modlandQaMask = qa.bitwiseAnd(3).eq(0); // Bit 0-1 (MODLAND_QA) = 00
  var viQualityMask = qa.bitwiseAnd(60).eq(0); // Bit 2-5 (VI_Quality) = 0000 (0x00)
  var cloudStateMask = qa.bitwiseAnd(192).eq(0); // Bit 6-7 (Cloud_State) = 00

  // 모든 마스크 조건을 충족하는 픽셀만 남김
  var combinedMask = modlandQaMask.and(viQualityMask).and(cloudStateMask);

  return image.updateMask(combinedMask);
}

// ----------------------------------------------------

// 분석할 연도 리스트
var years = ee.List.sequence(2020, 2024);

// 모든 연도의 결과를 저장할 빈 FeatureCollection
var allYearsStats = ee.FeatureCollection([]);

// ** --- 핵심 조절 변수: NDVI 임계값 --- **
// MODIS NDVI는 스케일링 팩터가 있으므로, 실제 NDVI 값을 사용하려면 스케일링을 적용해야 합니다.
// MOD13Q1의 NDVI는 -2000에서 10000 사이의 정수 값으로, 0.0001의 스케일 팩터가 있습니다.
// 따라서 0.6의 NDVI 임계값은 MODIS 값으로 0.6 / 0.0001 = 6000이 됩니다.
// 0.8의 NDVI 임계값은 MODIS 값으로 0.8 / 0.0001 = 8000이 됩니다.
var NDVI_THRESHOLD_MODIS = 6000; // NDVI 0.6에 해당하는 MODIS 스케일 값

// 각 연도별로 루프를 돌며 녹지 면적 계산
years.evaluate(
  function (yearList) {
    yearList.forEach(function (year) {
      year = ee.Number(year);

      // MODIS NDVI 컬렉션 불러오기: MOD13Q1
      var modis = ee
        .ImageCollection("MODIS/061/MOD13Q1")
        .filterDate(ee.Date.fromYMD(year, 5, 1), ee.Date.fromYMD(year, 8, 31))
        .filterBounds(koreaWithEnglish)
        .map(maskModisClouds) // MODIS 전용 마스킹 함수 적용
        .select("NDVI") // NDVI 밴드 선택
        .median(); // 중간값 합성

      // NDVI 임계값 적용
      // MODIS NDVI는 0.0001 스케일 팩터가 이미 적용된 상태로 임계값과 비교합니다.
      var greenAreaBinary = modis.gte(NDVI_THRESHOLD_MODIS);

      // 픽셀 면적 계산 (MODIS 250m x 250m = 62500㎡)
      var pixelAreaSqM = ee.Number(250).pow(2);

      // 구별 녹지 면적 합산
      var stats = greenAreaBinary.reduceRegions({
        collection: koreaWithEnglish,
        reducer: ee.Reducer.sum(),
        scale: 250, // MODIS 해상도에 맞춰 스케일 변경
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

    print("2020-2024 통합 구별 녹지 면적 (㎡) - MODIS MOD13Q1:", allYearsStats);

    Export.table.toDrive({
      collection: allYearsStats,
      description: "MODIS_NDVI_GreenArea_Seoul_2020_2024",
      folder: "GEE_Exports",
      fileNamePrefix:
        "MODIS_GreenArea_Seoul_2020_2024_NDVI_" + NDVI_THRESHOLD_MODIS / 10000,
      fileFormat: "CSV",
      selectors: ["code", "name_eng", "area_m2", "year"],
    });
  },
  function (error) {
    print("Error processing years:", error);
  }
);
