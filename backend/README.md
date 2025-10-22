# Inventory Simulation API

ระบบจำลองการจัดการสินค้าคงคลังแบบเรียลไทม์ พร้อมการวิเคราะห์ฤดูกาล เทศกาล และเทรนด์ของแบรนด์แฟชั่นชั้นนำ

## 📋 ภาพรวม

API นี้จำลองการบริหารสินค้าคงคลังสำหรับแบรนด์แฟชั่น (NIKE, ADIDAS, PUMA, H&M) โดยใช้ข้อมูลย้อนหลังจริง รองรับการวิเคราะห์:
- 🌦️ **ฤดูกาล** - 12 เดือนแบ่งเป็น 4 ไตรมาส พร้อม seasonality factors
- 🎉 **เทศกาล** - 14 เทศกาลสำคัญที่ส่งผลต่อยอดขาย (multiplier 1.2x - 2.2x)
- 📈 **เทรนด์** - วิเคราะห์ทั้งระดับแบรนด์และผลิตภัณฑ์ (uptrend/downtrend/sideways)
- 📦 **Stock Management** - Periodic restock และ Reorder point system

## 🚀 การติดตั้ง

### ข้อกำหนด
- Python 3.8+
- pip หรือ conda

### ขั้นตอนการติดตั้ง

1. **Clone repository**
```bash
git clone <repository-url>
cd inventory-simulation
```

2. **สร้าง Virtual Environment**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. **ติดตั้ง Dependencies**
```bash
pip install -r requirements.txt
```

4. **ตั้งค่า Environment Variables**

สร้างไฟล์ `.env` ในโฟลเดอร์หลัก:

```env
# Brand Data Paths
BRAND_ADIDAS_PATH=data/adidas_sales.csv
BRAND_NIKE_PATH=data/nike_sales.csv
BRAND_PUMA_PATH=data/puma_sales.csv
BRAND_H_M_PATH=data/h_m_sales.csv
```

5. **เตรียมข้อมูล**

วางไฟล์ CSV ในโฟลเดอร์ `data/` โดยแต่ละไฟล์ควรมีคอลัมน์:
- `Invoice Date` - วันที่ขาย
- `Brand` - ชื่อแบรนด์
- `Product` - ชื่อผลิตภัณฑ์
- `Units Sold` - จำนวนที่ขาย
- `Price per Unit` - ราคาต่อหน่วย
- `Total Sales` - ยอดขายรวม

**หมายเหตุ:** หากไม่มีไฟล์ข้อมูล ระบบจะสร้างข้อมูลตัวอย่างอัตโนมัติ

6. **เริ่มต้น API Server**
```bash
python main.py
```

API จะพร้อมใช้งานที่:
- **API:** http://localhost:8000
- **Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## 📚 โครงสร้างโปรเจค

```
inventory-simulation/
├── main.py                     # Entry point
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables
├── data/                       # CSV data files
│   ├── adidas_sales.csv
│   ├── nike_sales.csv
│   ├── puma_sales.csv
│   └── h_m_sales.csv
├── models/
│   └── pydantic.py            # Pydantic models
├── routers/
│   ├── root.py                # Root endpoints
│   └── simulation.py          # Simulation endpoint
├── services/
│   ├── data_service.py        # Data loading & processing
│   └── simulation_service.py  # Simulation logic
├── simulation/
│   └── brand_simulation.py    # SimPy simulation
└── utils/
    ├── constants.py           # Season & Festival data
    └── helpers.py             # Helper functions
```

## 🎯 API Endpoints

### 1. Root
```http
GET /
```
ข้อมูลทั่วไปของ API

### 2. Health Check
```http
GET /health
```
ตรวจสอบสถานะระบบ

### 3. Brand Parameters
```http
GET /brand-params
```
พารามิเตอร์ที่คำนวณจากข้อมูลย้อนหลัง

### 4. Seasons & Festivals
```http
GET /seasons-festivals
```
ข้อมูลฤดูกาลและเทศกาลทั้งหมด

### 5. Available Brands
```http
GET /available-brands
```
รายการแบรนด์ที่รองรับ

### 6. Run Simulation (⭐ Main Endpoint)
```http
POST /simulate
```

## 📊 ตัวอย่างการใช้งาน

### Basic Simulation (365 วัน)
```json
{
  "simulation_days": 365,
  "NIKE": {
    "initial_stock": 1000,
    "restock_days": 25,
    "restock_quantity": 500,
    "demand_multiplier": 1.0
  }
}
```

### Date Range Simulation (Feb 1 - Apr 10)
```json
{
  "start_day": 31,
  "end_day": 100,
  "NIKE": {
    "initial_stock": 800
  },
  "ADIDAS": {
    "initial_stock": 600
  }
}
```

**📅 Day of Year Reference:**
- 0 = Jan 1
- 31 = Feb 1
- 59 = Mar 1
- 90 = Apr 1
- 120 = May 1
- 151 = Jun 1
- 181 = Jul 1
- 212 = Aug 1
- 243 = Sep 1
- 273 = Oct 1
- 304 = Nov 1
- 334 = Dec 1

### Custom Festival Multipliers
```json
{
  "simulation_days": 90,
  "festival_demand": {
    "multipliers": {
      "valentine": 2.0,
      "black_friday": 3.0
    },
    "start_day": 0,
    "end_day": 89,
    "total_days": 90
  },
  "NIKE": {
    "initial_stock": 1500
  }
}
```

### Multiple Brands with Reorder Point
```json
{
  "simulation_days": 180,
  "NIKE": {
    "initial_stock": 1000,
    "reorder_point": 200,
    "reorder_quantity": 500,
    "enable_reorder": true
  },
  "ADIDAS": {
    "initial_stock": 800,
    "restock_days": 30,
    "restock_quantity": 400
  }
}
```

## 📦 BrandConfig Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initial_stock` | int | Auto-calculated | สต็อกเริ่มต้น |
| `restock_days` | int | 25 | รอบเติมสต็อกปกติ (วัน) |
| `restock_quantity` | int | Auto | จำนวนเติมสต็อกแบบ periodic |
| `reorder_point` | int | Auto | จุดสั่งซื้อใหม่ (units) |
| `reorder_quantity` | int | Auto | จำนวนเติมเมื่อถึง reorder point |
| `demand_multiplier` | float | 1.0 | ตัวคูณความต้องการ (0.5 = -50%, 2.0 = +100%) |
| `enable_reorder` | bool | true | เปิด/ปิดระบบ reorder point |

## 🎉 เทศกาลที่รองรับ (14 เทศกาล)

| Festival ID | ชื่อ | เดือน | วัน | Multiplier |
|-------------|------|-------|-----|------------|
| `new_year` | New Year Sale | มกราคม | 1-3 | 1.8x |
| `valentine` | Valentine's Day | กุมภาพันธ์ | 13-15 | 1.5x |
| `womens_day` | Women's Day | มีนาคม | 8 | 1.3x |
| `songkran` | Songkran Festival | เมษายน | 13-15 | 1.4x |
| `mothers_day` | Mother's Day | พฤษภาคม | 10-12 | 1.4x |
| `mid_year_sale` | Mid Year Sale | มิถุนายน | 15-21 | 1.6x |
| `fathers_day` | Father's Day | มิถุนายน | 16-18 | 1.3x |
| `back_to_school` | Back to School | สิงหาคม | 1-14 | 1.7x |
| `halloween` | Halloween | ตุลาคม | 30-31 | 1.2x |
| `singles_day` | 11.11 Sale | พฤศจิกายน | 11 | 2.0x |
| `black_friday` | Black Friday | พฤศจิกายน | 24-27 | 2.2x |
| `cyber_monday` | Cyber Monday | พฤศจิกายน | 28-29 | 1.9x |
| `christmas` | Christmas Sale | ธันวาคม | 20-25 | 2.0x |
| `year_end` | Year End Sale | ธันวาคม | 26-31 | 1.8x |

## 🌦️ ฤดูกาล (Season Types)

| Quarter | เดือน | Season Type |
|---------|-------|-------------|
| Q1 | มกราคม | High Season |
| Q1 | กุมภาพันธ์ | High Season |
| Q1 | มีนาคม | Medium Season |
| Q2 | เมษายน | Medium Season |
| Q2 | พฤษภาคม | Low Season |
| Q2 | มิถุนายน | Medium Season |
| Q3 | กรกฎาคม | Low Season |
| Q3 | สิงหาคม | High Season |
| Q3 | กันยายน | Medium Season |
| Q4 | ตุลาคม | Medium Season |
| Q4 | พฤศจิกายน | **Peak Season** |
| Q4 | ธันวาคม | **Peak Season** |

## 📈 Response Structure

```typescript
{
  "daily_data": DailyData[],           // รายวัน
  "monthly_data": MonthlyData[],       // รายเดือน
  "restock_events": RestockEvent[],    // เหตุการณ์เติมสต็อก
  "reorder_point_events": ReorderPointEvent[],  // Reorder triggers
  "festival_events": FestivalEvent[],  // เทศกาลที่เกิดขึ้น
  "season_events": SeasonEvent[],      // ฤดูกาลที่ส่งผล
  "summary": BrandSummary[],           // สรุปแต่ละแบรนด์
  "best_selling_products": {...}[],    // สินค้าขายดี
  "simulation_days": number,
  
  // Trend Analysis (Brand Level)
  "monthly_trends": MonthlyTrend[],    // เทรนด์รายเดือน
  "trend_events": TrendEvent[],        // เหตุการณ์เปลี่ยนเทรนด์
  
  // Trend Analysis (Product Level)
  "product_monthly_trends": MonthlyProductTrend[],
  "product_trend_events": ProductTrendEvent[]
}
```

## 🔧 การ Customize

### เพิ่มแบรนด์ใหม่

1. เพิ่มใน `.env`:
```env
BRAND_NEWBRAND_PATH=data/newbrand_sales.csv
```

2. เพิ่มใน `data_service.py`:
```python
SUPPORTED_BRANDS = {
    'NEWBRAND': os.getenv("BRAND_NEWBRAND_PATH"),
    # ...
}
```

3. เพิ่มใน `pydantic.py`:
```python
class SimulationRequest(BaseModel):
    NEWBRAND: Optional[BrandConfig] = None
    # ...
```

### เพิ่มเทศกาลใหม่

แก้ไข `utils/constants.py`:
```python
FESTIVALS = {
    "my_festival": {
        "month": 7,
        "days": [15, 16, 17],
        "name": "My Special Sale",
        "multiplier": 1.5
    }
}
```

## 🐛 Troubleshooting

### ไม่สามารถโหลดข้อมูลได้
- ตรวจสอบ path ใน `.env` ว่าถูกต้อง
- ตรวจสอบว่าไฟล์ CSV มีอยู่จริง
- ตรวจสอบ encoding ของไฟล์ (ควรเป็น UTF-8)

### Stock เป็นลบ
- ตรวจสอบ `initial_stock` ว่าเพียงพอ
- เพิ่ม `restock_quantity` หรือลด `restock_days`
- เปิดใช้ `enable_reorder: true`

### Simulation ช้า
- ลด `simulation_days`
- ลดจำนวนแบรนด์ที่ simulate พร้อมกัน

## 📝 Requirements

```txt
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
pandas==2.1.3
numpy==1.26.2
python-dotenv==1.0.0
simpy==4.1.1
```

## 📝 Env

```txt
BRAND_ADIDAS_PATH=data/adidas_sales.csv
BRAND_NIKE_PATH=data/nike_sales.csv
BRAND_PUMA_PATH=data/puma_sales.csv
BRAND_H_M_PATH=data/h_m_sales.csv
```

## 🤝 การพัฒนา

### การทดสอบ
```bash
# Run tests
pytest

# Run with coverage
pytest --cov=.
```

### Code Style
```bash
# Format code
black .

# Lint
flake8 .
```

## 📄 License

MIT License - ใช้งานได้อย่างอิสระ

## 👥 Contributors

- Your Team Name

## 📞 ติดต่อ

- Email: tiwzazaza1234@gmail.com
- GitHub: https://github.com/TiwKill

---

**Made with ❤️ for Inventory Management**