# 🌡️ Urban Heat Island Prediction Project

## 📋 프로젝트 개요

서울시 도시 열섬 현상(Urban Heat Island)을 예측하는 머신러닝 프로젝트입니다.
S-DoT 센서 데이터와 공간정보를 활용하여 각 구별 도시 열섬 강도(UHII)를 예측하고,
실시간 웹 서비스로 구현했습니다.

## 🎯 주요 목표

- 서울시 25개 구별 도시 열섬 강도(UHII) 예측 모델 개발
- 다양한 도시 환경 요소를 고려한 예측 시스템 구축
- 실시간 예측 결과를 시각화하는 웹 애플리케이션 개발

## 🗂️ 프로젝트 구조

```
├── 📁 scripts/                # Google Earth Engine 데이터 수집 스크립트
│   ├── landsat8_ndvi_green_area_calculation.js      # Landsat 8 기반 구별 녹지면적 계산
│   ├── modis_ndvi_green_area_calculation.js         # MODIS 기반 구별 녹지면적 계산
│   └── sentinel2_ndvi_visualization_sampling.js     # Sentinel-2 NDVI 시각화 및 샘플링
│
├── 📁 data/                    # 데이터 파일
│   ├── S-DoT_NATURE_*.csv     # S-DoT 센서 데이터 (2023.01-02)
│   ├── NDVI/                  # 정규식생지수 데이터
│   ├── UHI데이터 통합/         # 통합 도시열섬 데이터
│   └── 분석테스트.lvdash.json # 분석 설정 파일
│
├── 📁 notebooks/              # Jupyter 노트북 (데이터 파이프라인 → ML 모델링)
│   ├── 01_data_integration.ipynb                 # 다중 데이터소스 통합 및 조인
│   ├── 02_data_preprocessing.ipynb               # UHII 라벨 데이터 전처리
│   ├── 03_feature_engineering.ipynb              # 시계열 피처 엔지니어링
│   ├── 04_h2o_automl_complete_pipeline.ipynb     # H2O AutoML 전체 파이프라인
│   ├── 05_h2o_automl_mlflow_deployment.ipynb     # H2O AutoML + MLflow 배포
│   ├── 06_databricks_automl_forecast.ipynb       # Databricks AutoML 시계열 예측
│   └── 07_spark_mllib_model_comparison.ipynb     # Spark MLlib 모델 성능 비교
│
├── 📁 models/                 # 모델 관련 파일
│   └── databricks_automl/     # Databricks AutoML 결과
│
├── 📁 web-app/               # 웹 애플리케이션
│   ├── app.py                # Flask 웹 서버
│   ├── data/                 # 웹앱용 데이터
│   ├── templates/            # HTML 템플릿
│   └── requirements.txt      # Python 의존성
│
└── 📁 docs/                  # 문서화 폴더
```

## 🔧 기술 스택

- **Machine Learning**: H2O AutoML, XGBoost, Spark MLlib
- **Data Processing**: Apache Spark, Pandas, NumPy
- **Web Framework**: Flask, JavaScript
- **Database**: PostgreSQL
- **Visualization**: Plotly, Folium (지도 시각화)
- **Cloud Platform**: Databricks
- **APIs**: 기상청 API

## 📊 데이터 및 피처

### 입력 변수

- `green_rate`: 녹지율
- `Building_Density`: 건물 밀도
- `car_registration_count`: 차량 등록 수
- `population_density`: 인구 밀도
- `avg_km_per_road_km`: 도로 밀도
- `suburban_temp_current`: 기준 온도 (관악산 기상관측소)
- `timestamp`: 시간 정보

### 예측 변수

- `UHII`: 도시 열섬 강도 (Urban Heat Island Intensity)

## 🚀 주요 기능

### 1. 머신러닝 모델

- **H2O AutoML**: 자동화된 모델 선택 및 하이퍼파라미터 튜닝
- **다중 알고리즘 비교**: XGBoost, Random Forest, GLM 등
- **교차 검증**: 모델 성능 평가 및 일반화

### 2. 웹 애플리케이션

- **실시간 예측**: 사용자 입력에 따른 UHII 실시간 계산
- **시각화 대시보드**: 서울시 구별 열섬 현상 히트맵
- **기상 데이터 연동**: 기상청 API를 통한 실시간 온도 데이터
- **Power BI 연동**: 고급 분석 리포트

## 📊 데이터 출처

- **S-DoT**: 서울시 디지털 관측망 데이터
- **기상청**: ASOS 기상관측 데이터
- **서울시**: 공간정보, 인구통계, 교통량 데이터

## 🏆 프로젝트 성과

- MS 데이터스쿨 1기 Databricks 프로젝트
- 실시간 도시 열섬 예측 시스템 구현
- 웹 기반 시각화 대시보드 개발

## 📝 라이선스

이 프로젝트는 교육 목적으로 개발되었습니다.

## 👥 팀 정보

MS 데이터스쿨 1기 프로젝트팀

---

_본 프로젝트는 도시 환경 개선과 기후 변화 대응을 위한 데이터 기반 솔루션 개발을 목표로 합니다._
