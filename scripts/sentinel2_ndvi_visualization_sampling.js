// 서울시 행정구역 (자치구) FeatureCollection 불러오기
var seoul = ee.FeatureCollection(
  "projects/future-name-405308/assets/LARD_ADM_SECT_SGG_11_202505"
);

// QA60 기반 구름 마스크
function cloudMaskQA60(image) {
  var cloudProb = image.select("QA60");
  var cloudBitMask = ee.Number(2).pow(10).int();
  var cirrusBitMask = ee.Number(2).pow(11).int();
  var mask = cloudProb
    .bitwiseAnd(cloudBitMask)
    .eq(0)
    .and(cloudProb.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).copyProperties(image, ["system:time_start"]);
}

// s2cloudless 구름 마스크
function cloudMaskS2(image) {
  var hasCloudProb = image.bandNames().contains("probability");
  // HARMONIZED 컬렉션에서도 'probability' 밴드가 있으면 이를 사용하고, 없으면 QA60 기반으로 폴백합니다.
  var mask = hasCloudProb
    ? image.select("probability").lt(50)
    : cloudMaskQA60(image);
  return image.updateMask(mask).copyProperties(image, ["system:time_start"]);
}

// NDVI 계산 함수: 기간, 영역 입력받아 median NDVI 반환
function getNDVI(startDate, endDate, region) {
  // COPERNICUS/S2_SR_HARMONIZED 컬렉션으로 변경
  var collection = ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterDate(startDate, endDate)
    .filterBounds(region)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    .map(function (image) {
      // S2_CLOUD_PROBABILITY도 COPERNICUS/S2_SR_HARMONIZED와 동일한 시스템 인덱스를 가지므로
      // 기존 방식대로 조인하여 사용합니다.
      var cloudImage = ee
        .ImageCollection("COPERNICUS/S2_CLOUD_PROBABILITY")
        .filterDate(startDate, endDate)
        .filterBounds(region)
        .filter(ee.Filter.eq("system:index", image.get("system:index")))
        .first();
      // cloudImage가 null일 경우를 대비하여 조건부 addBands를 추가합니다.
      return cloudImage
        ? image.addBands(cloudImage.select("probability"))
        : image;
    })
    .map(cloudMaskS2)
    .select(["B4", "B8"])
    .sort("CLOUDY_PIXEL_PERCENTAGE")
    .limit(10); // 이미지 수 10장 제한

  var ndvi = collection
    .median()
    .normalizedDifference(["B8", "B4"])
    .rename("NDVI");
  return ndvi.clip(region);
}

// 관심 연도 리스트
var years = [2020, 2021, 2022, 2023, 2024];

// 연도별 NDVI 이미지 저장할 객체
var ndviImages = {};

// 서울 전체 영역
var seoulGeom = seoul.geometry();

// 연도별 NDVI 이미지 계산
years.forEach(function (year) {
  var start = year + "-05-01";
  var end = year + "-08-31";
  ndviImages[year] = getNDVI(start, end, seoulGeom);
  // NDVI 이미지를 지도에 추가하여 시각적으로 비교합니다.
  Map.addLayer(
    ndviImages[year],
    { min: 0, max: 1, palette: ["white", "green"] },
    "NDVI " + year
  );
});

// NDVI 시각화 임계값 리스트
var thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

// 연도별로 NDVI ≥ 특정값 필터링 후 지도에 추가
years.forEach(function (year) {
  var ndviImage = ndviImages[year];

  // 각 임계값에 따라 녹지 영역을 지도에 표시합니다.
  thresholds.forEach(function (thresh) {
    var filtered = ndviImage.updateMask(ndviImage.gte(thresh));
    Map.addLayer(
      filtered,
      { min: thresh, max: 1, palette: ["white", "green"] },
      "NDVI ≥ " + thresh + " (" + year + ")"
    );
  });
});

// 각 구별, 연도별 NDVI 샘플링 함수
function sampleNDVIByDistrict(year, ndviImage) {
  var samples = ndviImage.sampleRegions({
    collection: seoul,
    scale: 10,
    geometries: true, // 각 샘플 지점에 지오메트리 정보도 포함합니다.
  });

  // 각 샘플에 연도와 구 이름을 추가합니다.
  var values = samples.map(function (feature) {
    return feature
      .set("year", year)
      .set("district", feature.get("SGG_NM"))
      .select(["NDVI", "year", "district"]); // 필요한 속성만 선택합니다.
  });
  return values;
}

// 연도별로 모두 샘플링해서 합치기
var allSamples = years.map(function (year) {
  return sampleNDVIByDistrict(year, ndviImages[year]);
});

var mergedSamples = ee.FeatureCollection(allSamples).flatten();

print("fin");
// 지도 중심을 서울로 설정합니다.
Map.centerObject(seoulGeom, 10);
