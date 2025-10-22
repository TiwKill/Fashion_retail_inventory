import os
import pandas as pd
from datetime import datetime, timedelta
import random
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

# กำหนดแบรนด์ที่รองรับทั้งหมด (อ่านจาก .env)
SUPPORTED_BRANDS = {
    'ADIDAS': os.getenv("BRAND_ADIDAS_PATH"),
    'NIKE': os.getenv("BRAND_NIKE_PATH"),
    'PUMA': os.getenv("BRAND_PUMA_PATH"),
    'H&M': os.getenv("BRAND_H_M_PATH")
}

historical_data = None
brand_parameters = None

def load_and_prepare_data() -> Optional[pd.DataFrame]:
    print("📂 กำลังโหลดข้อมูลจากไฟล์...")
    print("📁 BRAND PATHS:", SUPPORTED_BRANDS)
    dfs = []
    _seen_signatures = set()  # (size, mtime) เพื่อตรวจไฟล์ซ้ำ

    for brand_name, file_path in SUPPORTED_BRANDS.items():
        try:
            if not file_path or not os.path.exists(file_path):
                print(f"⚠️ ไม่พบไฟล์สำหรับ {brand_name}: {file_path}")
                continue

            # ตรวจไฟล์ซ้ำ (ป้องกัน path ชี้ไฟล์เดียวกัน)
            try:
                st = os.stat(file_path)
                sig = (st.st_size, int(st.st_mtime))
                if sig in _seen_signatures:
                    print(f"⚠️ พบไฟล์ซ้ำกันระหว่างแบรนด์ (ขนาด/mtime เท่ากัน): {brand_name} → {file_path}")
                _seen_signatures.add(sig)
            except Exception as e:
                print(f"⚠️ ตรวจลายเซ็นไฟล์ไม่ได้: {file_path} ({e})")

            # ลองอ่านหลาย encoding
            read_success = False
            for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    df = pd.read_csv(file_path, encoding=encoding, on_bad_lines='skip', low_memory=False)
                    # 🔒 บังคับแบรนด์จากไฟล์
                    df['Brand'] = brand_name
                    dfs.append(df)
                    print(f"✅ โหลดไฟล์ {file_path} สำเร็จด้วย encoding {encoding} ({len(df)} แถว)")
                    read_success = True
                    break
                except UnicodeDecodeError:
                    continue
                except pd.errors.ParserError as e:
                    print(f"⚠️ ParserError {file_path}: {e} → ลอง engine='python'")
                    try:
                        df = pd.read_csv(file_path, encoding=encoding, sep=None, engine='python', on_bad_lines='skip')
                        df['Brand'] = brand_name  # 🔒
                        dfs.append(df)
                        print(f"✅ โหลดไฟล์ {file_path} สำเร็จด้วยวิธีสำรอง ({len(df)} แถว)")
                        read_success = True
                        break
                    except Exception as e2:
                        print(f"❌ อ่านวิธีสำรองล้มเหลว: {e2}")
                        continue
                except Exception as e:
                    print(f"⚠️ อ่านไฟล์ {file_path} ล้มเหลว: {e}")
                    continue

            if not read_success:
                print(f"❌ ไม่สามารถโหลดไฟล์ {file_path} ด้วย encoding ใดๆ")

        except Exception as e:
            print(f"❌ ไม่สามารถโหลดไฟล์สำหรับ {brand_name}: {e}")

    if not dfs:
        print("⚠️ ไม่พบไฟล์ข้อมูล, จะใช้ข้อมูลจำลองแทน")
        return None

    df = pd.concat(dfs, ignore_index=True)

    # จัดการวันที่
    date_columns = ['Invoice Date', 'invoice_date', 'InvoiceDate']
    found = None
    for c in date_columns:
        if c in df.columns:
            found = c
            break
    if found:
        try:
            df['Invoice Date'] = pd.to_datetime(df[found], dayfirst=True, format='mixed')
        except Exception:
            try:
                df['Invoice Date'] = pd.to_datetime(df[found], format='%d/%m/%Y')
            except Exception:
                try:
                    df['Invoice Date'] = pd.to_datetime(df[found], format='%m/%d/%Y')
                except Exception:
                    df['Invoice Date'] = pd.to_datetime(df[found], infer_datetime_format=True)
    else:
        print("⚠️ ไม่พบคอลัมน์วันที่, สร้างวันที่สุ่มแทน")
        df['Invoice Date'] = pd.date_range(start='2020-01-01', periods=len(df), freq='D')

    # ทำความสะอาดตัวเลข
    print("\n🔧 กำลังทำความสะอาดข้อมูลตัวเลข...")

    def clean_numeric(series):
        if series.dtype == 'object':
            s = series.astype(str).str.replace('$', '', regex=False).str.replace(',', '', regex=False).str.strip()
            s = s.replace(['', 'nan', 'NaN', 'None', 'NULL'], '0')
            return pd.to_numeric(s, errors='coerce').fillna(0)
        return series.fillna(0)

    for col in ['Units Sold', 'Total Sales', 'Operating Profit', 'Operating Margin', 'Price per Unit']:
        if col in df.columns:
            before = df[col].sum() if df[col].dtype != 'object' else 0
            df[col] = clean_numeric(df[col])
            after = df[col].sum()
            print(f"  ทำความสะอาด: {col} → ก่อน {before:.2f}, หลัง {after:.2f}")

    df = df.dropna(subset=['Brand', 'Invoice Date'])

    # Normalize ชื่อแบรนด์ (แต่เรา set จากไฟล์แล้ว ปลอดภัยอยู่)
    brand_mapping = {
        'ADIDAS': 'ADIDAS', 'NIKE': 'NIKE', 'PUMA': 'PUMA', 'H&M': 'H&M',
        'adidas': 'ADIDAS', 'nike': 'NIKE', 'puma': 'PUMA', 'h&m': 'H&M',
        'Adidas': 'ADIDAS', 'Nike': 'NIKE', 'Puma': 'PUMA',
        'HM': 'H&M', 'hm': 'H&M'
    }
    df['Brand'] = df['Brand'].astype(str).map(brand_mapping).fillna(df['Brand'])

    # กรองเฉพาะแบรนด์ที่รองรับ
    df = df[df['Brand'].isin(SUPPORTED_BRANDS.keys())]

    print(f"\n📊 ข้อมูลรวมหลังทำความสะอาด: {len(df)} แถว")
    print(f"📅 ช่วงเวลา: {df['Invoice Date'].min()} ถึง {df['Invoice Date'].max()}")
    print(f"🏷️ แบรนด์: {', '.join(sorted(df['Brand'].unique()))}")

    for brand in SUPPORTED_BRANDS.keys():
        bd = df[df['Brand'] == brand]
        if len(bd) > 0:
            if 'Units Sold' in bd.columns:
                print(f"  {brand}: {len(bd)} แถว, Units Sold รวม: {bd['Units Sold'].sum():,.0f}")
            else:
                print(f"  {brand}: {len(bd)} แถว, (ไม่มี Units Sold)")

    return df

def create_sample_data() -> pd.DataFrame:
    print("📝 สร้างข้อมูลตัวอย่าง...")
    sample = []
    brands = list(SUPPORTED_BRANDS.keys())
    profiles = {
        'ADIDAS': {'base_demand': 45, 'price_range': (120, 200)},
        'NIKE': {'base_demand': 55, 'price_range': (150, 250)},
        'PUMA': {'base_demand': 35, 'price_range': (80, 150)},
        'H&M': {'base_demand': 60, 'price_range': (50, 120)}
    }
    for b in brands:
        pf = profiles.get(b, {'base_demand': 50, 'price_range': (80, 200)})
        for _ in range(1000):
            sample.append({
                'Brand': b,
                'Invoice Date': datetime(2023, 1, 1) + timedelta(days=random.randint(0, 364)),
                'Units Sold': random.randint(1, 100),
                'Price per Unit': random.uniform(*pf['price_range']),
                'Total Sales': random.uniform(100, 5000),
                'Operating Profit': random.uniform(10, 500),
                'Operating Margin': random.uniform(0.1, 0.3),
                'Region': random.choice(['North', 'South', 'East', 'West']),
                'Product': f'Product_{random.randint(1, 50)}'
            })
    return pd.DataFrame(sample)

def calculate_brand_parameters(df: pd.DataFrame) -> Dict[str, Any]:
    brand_params: Dict[str, Any] = {}

    print("\n🔍 DEBUG: ตรวจสอบข้อมูลก่อนคำนวณพารามิเตอร์")
    for brand in SUPPORTED_BRANDS.keys():
        bd = df[df['Brand'] == brand]
        print(f"\n{brand}:")
        print(f"  จำนวนแถว: {len(bd)}")
        if len(bd) > 0 and 'Units Sold' in bd.columns:
            print(f"  Units Sold - รวม: {bd['Units Sold'].sum():,.0f}, ค่าเฉลี่ย: {bd['Units Sold'].mean():.2f}")
            print(f"  ตัวอย่างค่า: {bd['Units Sold'].head(5).tolist()}")
        if len(bd) > 0 and 'Price per Unit' in bd.columns:
            print(f"  Price per Unit - ค่าเฉลี่ย: {bd['Price per Unit'].mean():.2f}")

    for brand in SUPPORTED_BRANDS.keys():
        bd = df[df['Brand'] == brand].copy()

        min_date, max_date = "N/A", "N/A"
        num_days = 365
        total_units = 0.0
        base_daily_demand = 50.0
        avg_price = 100.0

        units_col = None
        for c in ['Units Sold', 'units_sold', 'UnitsSold', 'Quantity', 'Qty']:
            if c in bd.columns:
                units_col = c
                break

        if len(bd) == 0 or units_col is None:
            # mock
            mock = {
                'ADIDAS': {'base_demand': 120, 'avg_price': 120},
                'NIKE': {'base_demand': 150, 'avg_price': 150},
                'PUMA': {'base_demand': 80,  'avg_price': 90},
                'H&M':  {'base_demand': 200, 'avg_price': 70}
            }.get(brand, {'base_demand': 50, 'avg_price': 100})
            base_daily_demand = float(mock['base_demand'])
            avg_price = float(mock['avg_price'])
            seasonality = {m: 1.0 for m in range(1, 13)}
        else:
            total_units = float(bd[units_col].sum())
            if total_units == 0:
                mock = {
                    'ADIDAS': {'base_demand': 120, 'avg_price': 120},
                    'NIKE': {'base_demand': 150, 'avg_price': 150},
                    'PUMA': {'base_demand': 80,  'avg_price': 90},
                    'H&M':  {'base_demand': 200, 'avg_price': 70}
                }.get(brand, {'base_demand': 50, 'avg_price': 100})
                base_daily_demand = float(mock['base_demand'])
                avg_price = float(mock['avg_price'])
                seasonality = {m: 1.0 for m in range(1, 13)}
            else:
                try:
                    min_date = bd['Invoice Date'].min()
                    max_date = bd['Invoice Date'].max()
                    if pd.isna(min_date) or pd.isna(max_date):
                        num_days = len(bd['Invoice Date'].unique())
                        min_date, max_date = "N/A", "N/A"
                    else:
                        dr = (max_date - min_date).days + 1
                        num_days = dr if dr > 0 else len(bd['Invoice Date'].unique())
                    base_daily_demand = float(total_units / num_days) if num_days > 0 else 50.0

                    monthly_sales = bd.groupby(bd['Invoice Date'].dt.month)[units_col].sum()
                    avg_sales = monthly_sales.mean() if len(monthly_sales) > 0 else 0.0
                    seasonality = {}
                    for m in range(1, 13):
                        if m in monthly_sales.index and avg_sales > 0:
                            seasonality[m] = float(monthly_sales[m] / avg_sales)
                        else:
                            seasonality[m] = 1.0

                    if 'Price per Unit' in bd.columns:
                        vp = bd[bd['Price per Unit'] > 0]['Price per Unit']
                        if len(vp) > 0:
                            avg_price = float(vp.mean())
                        elif 'Total Sales' in bd.columns:
                            valid = bd[(bd['Total Sales'] > 0) & (bd[units_col] > 0)]
                            if len(valid) > 0:
                                avg_price = float(valid['Total Sales'].sum() / valid[units_col].sum())
                    elif 'Total Sales' in bd.columns:
                        valid = bd[(bd['Total Sales'] > 0) & (bd[units_col] > 0)]
                        if len(valid) > 0:
                            avg_price = float(valid['Total Sales'].sum() / valid[units_col].sum())

                except Exception as e:
                    print(f"❌ เกิดข้อผิดพลาดในการคำนวณสำหรับ {brand}: {e}")
                    mock = {'base_demand': 50, 'avg_price': 100}
                    base_daily_demand = float(mock['base_demand'])
                    avg_price = float(mock['avg_price'])
                    seasonality = {m: 1.0 for m in range(1, 13)}

        # baseline รายเดือน = seasonality * base_daily_demand * days_in_month
        monthly_baseline_units = {}
        for m in range(1, 13):
            dim = pd.Period(f"2024-{m:02d}").days_in_month
            sf = seasonality.get(m, 1.0)
            monthly_baseline_units[m] = float(sf * base_daily_demand * dim)

        initial_stock = int(base_daily_demand * 30)
        restock_days = 25
        restock_quantity = int(base_daily_demand * 25)
        reorder_quantity = int(base_daily_demand * 30)
        reorder_point = int(base_daily_demand * 7)

        brand_params[brand] = {
            'base_demand': float(base_daily_demand),
            'seasonality': seasonality,
            'avg_price': float(avg_price),
            'monthly_baseline_units': monthly_baseline_units,
            'calculated_config': {
                'initial_stock': initial_stock,
                'restock_days': restock_days,
                'restock_quantity': restock_quantity,
                'reorder_quantity': reorder_quantity,
                'reorder_point': reorder_point,
                'demand_multiplier': 1.0
            }
        }

        print(f"\n🏷️ {brand}:")
        print(f" 📊 ช่วงวันที่: {min_date} ถึง {max_date} ({num_days} วัน)")
        print(f" 📊 ความต้องการเฉลี่ยต่อวัน: {base_daily_demand:.1f} units (จาก {int(total_units):,} units)")
        print(f" 💰 ราคาเฉลี่ย: ${avg_price:.2f}")
        print(f" 📦 สต็อกเริ่มต้นที่คำนวณ: {initial_stock:,} units")

    return brand_params

def init_data():
    global historical_data, brand_parameters
    try:
        historical_data = load_and_prepare_data()
        if historical_data is None:
            historical_data = create_sample_data()
        brand_parameters = calculate_brand_parameters(historical_data)
        print("\n✅ โหลดข้อมูลและคำนวณพารามิเตอร์สำเร็จ")
    except Exception as e:
        print(f"❌ ไม่สามารถโหลดข้อมูลได้: {e}")
        historical_data = create_sample_data()
        brand_parameters = calculate_brand_parameters(historical_data)

def get_historical_data() -> Optional[pd.DataFrame]:
    return historical_data

def get_brand_parameters() -> Optional[Dict[str, Any]]:
    return brand_parameters

def get_supported_brands() -> List[str]:
    return list(SUPPORTED_BRANDS.keys())
