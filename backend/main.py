# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2 import Error
from psycopg2.extras import RealDictCursor
from typing import List, Optional, Dict, Any
import requests
from datetime import datetime, date
import io
import csv
from fastapi.responses import StreamingResponse

from database_connection import create_db_connection, close_db_connection


WEATHER_API_KEY = "bc0d79ca24319e4d2f4cc7e2cb519e0f"
OPENWEATHER_URL = "http://api.openweathermap.org/data/2.5/weather"

FARM_LAT = 10.06069
FARM_LON = -2.50192

app = FastAPI(
    title="Kalvin Fathers Farm API",
    description="API for Crop Yield and Soil Monitoring System (PostgreSQL)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CropBase(BaseModel):
    crop_name: str
    planting_season: Optional[str] = None
    expected_yield_per_acre: Optional[float] = None

class CropCreate(CropBase):
    pass

class Crop(CropBase):
    crop_id: int
    class Config:
        from_attributes = True

class WeatherBase(BaseModel):
    record_date: str
    location: str
    temperature_max_celsius: Optional[float] = None
    temperature_min_celsius: Optional[float] = None # Fixed: Added type annotation
    precipitation_mm: Optional[float] = None
    humidity_percentage: Optional[float] = None
    wind_speed_kph: Optional[float] = None
    weather_description: Optional[str] = None

class WeatherCreate(WeatherBase):
    pass

class Weather(WeatherBase):
    weather_id: int
    class Config:
        from_attributes = True

class YieldBase(BaseModel):
    crop_id: int
    harvest_date: str
    actual_yield: float
    unit: str
    field_location: Optional[str] = None
    notes: Optional[str] = None

class YieldCreate(YieldBase):
    pass

class Yield(YieldBase):
    yield_id: int
    crop_name: Optional[str] = None
    class Config:
        from_attributes = True

class SoilReadingBase(BaseModel):
    crop_id: Optional[int] = None
    reading_date: str
    soil_moisture_percentage: Optional[float] = None
    ph_level: Optional[float] = None
    nitrogen_level_ppm: Optional[float] = None
    phosphorus_level_ppm: Optional[float] = None
    potassium_level_ppm: Optional[float] = None
    notes: Optional[str] = None

class SoilReadingCreate(SoilReadingBase):
    pass

class SoilReading(SoilReadingBase):
    reading_id: int
    crop_name: Optional[str] = None
    class Config:
        from_attributes = True

class InputUsageBase(BaseModel):
    crop_id: Optional[int] = None
    usage_date: str
    input_type: str
    input_name: str
    quantity_used: float
    unit: str
    field_location: Optional[str] = None
    notes: Optional[str] = None

class InputUsageCreate(InputUsageBase):
    pass

class InputUsage(InputUsageBase):
    input_id: int
    crop_name: Optional[str] = None
    class Config:
        from_attributes = True

class FarmAdvice(BaseModel):
    message: str
    type: str # e.g., 'info', 'warning', 'success'

class InputCostBase(BaseModel):
    input_id: Optional[int] = None # Link to input_usage, but can be standalone
    cost_date: str
    item_name: str
    cost_amount: float
    currency: str = "USD" # Default currency
    notes: Optional[str] = None

class InputCostCreate(InputCostBase):
    pass

class InputCost(InputCostBase):
    cost_id: int
    input_type: Optional[str] = None # From linked input_usage
    class Config:
        from_attributes = True

class CropYieldForecast(BaseModel):
    crop_id: int
    crop_name: str
    average_yield: Optional[float] = None
    unit: Optional[str] = None # Unit might be null if no yields for the crop

@app.get("/")
async def read_root():
    return {"message": "Welcome to Kalvin Fathers Farm API!"}

@app.get("/crops/", response_model=List[Crop])
async def get_all_crops():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT crop_id, crop_name, planting_season, expected_yield_per_acre FROM crops ORDER BY crop_name ASC")
        crops_data = cursor.fetchall()
        return crops_data
    except Error as e:
        print(f"Error fetching crops: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.post("/crops/", response_model=Crop)
async def create_crop(crop: CropCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        INSERT INTO crops (crop_name, planting_season, expected_yield_per_acre)
        VALUES (%s, %s, %s) RETURNING crop_id;
        """
        cursor.execute(query, (crop.crop_name, crop.planting_season, crop.expected_yield_per_acre))
        new_crop_id = cursor.fetchone()[0]
        conn.commit()

        return Crop(
            crop_id=new_crop_id,
            crop_name=crop.crop_name,
            planting_season=crop.planting_season,
            expected_yield_per_acre=crop.expected_yield_per_acre
        )
    except Error as e:
        print(f"Error creating crop: {e}")
        conn.rollback()
        if "duplicate key value violates unique constraint" in str(e):
            raise HTTPException(status_code=409, detail=f"Crop with name '{crop.crop_name}' already exists.")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/crops/{crop_id}", response_model=Crop)
async def get_crop_by_id(crop_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT crop_id, crop_name, planting_season, expected_yield_per_acre FROM crops WHERE crop_id = %s", (crop_id,))
        crop_data = cursor.fetchone()

        if crop_data is None:
            raise HTTPException(status_code=404, detail="Crop not found")
        return crop_data
    except Error as e:
        print(f"Error fetching crop by ID: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.put("/crops/{crop_id}", response_model=Crop)
async def update_crop(crop_id: int, crop: CropCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        UPDATE crops
        SET crop_name = %s, planting_season = %s, expected_yield_per_acre = %s
        WHERE crop_id = %s
        """
        cursor.execute(query, (crop.crop_name, crop.planting_season, crop.expected_yield_per_acre, crop_id))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Crop not found")

        return Crop(
            crop_id=crop_id,
            crop_name=crop.crop_name,
            planting_season=crop.planting_season,
            expected_yield_per_acre=crop.expected_yield_per_acre
        )
    except Error as e:
        print(f"Error updating crop: {e}")
        conn.rollback()
        if "duplicate key value violates unique constraint" in str(e):
            raise HTTPException(status_code=409, detail=f"Another crop with name '{crop.crop_name}' already exists.")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.delete("/crops/{crop_id}", status_code=204)
async def delete_crop(crop_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        cursor.execute("DELETE FROM crops WHERE crop_id = %s", (crop_id,))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Crop not found")
        return {"message": "Crop deleted successfully"}
    except Error as e:
        print(f"Error deleting crop: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.post("/weather/fetch_and_store/", status_code=201)
async def fetch_and_store_weather_data():
    conn = None
    try:
        params = {
            'lat': FARM_LAT,
            'lon': FARM_LON,
            'appid': WEATHER_API_KEY,
            'units': 'metric' # Correct parameter name
        }
        response = requests.get(OPENWEATHER_URL, params=params)
        response.raise_for_status() # This will raise an HTTPError for 4xx/5xx responses
        weather_data_from_api = response.json()

        current_date = datetime.now().strftime('%Y-%m-%d')
        location_name = weather_data_from_api.get('name', 'Farm Location')
        main_weather = weather_data_from_api.get('main', {})
        wind_data = weather_data_from_api.get('wind', {})
        weather_desc = weather_data_from_api['weather'][0]['description'] if weather_data_from_api['weather'] else 'N/A'

        temp_max = main_weather.get('temp_max')
        temp_min = main_weather.get('temp_min')
        humidity = main_weather.get('humidity')
        wind_speed_kph = wind_data.get('speed') * 3.6 if wind_data.get('speed') is not None else None

        precipitation_mm = weather_data_from_api.get('rain', {}).get('1h', 0.0)

        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        INSERT INTO weather_data (
            record_date, location, temperature_max_celsius, temperature_min_celsius,
            precipitation_mm, humidity_percentage, wind_speed_kph, weather_description
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (record_date) DO UPDATE SET
            location = EXCLUDED.location,
            temperature_max_celsius = EXCLUDED.temperature_max_celsius,
            temperature_min_celsius = EXCLUDED.temperature_min_celsius,
            precipitation_mm = EXCLUDED.precipitation_mm,
            humidity_percentage = EXCLUDED.humidity_percentage,
            wind_speed_kph = EXCLUDED.wind_speed_kph,
            weather_description = EXCLUDED.weather_description
        RETURNING weather_id;
        """

        cursor.execute(query, (
            current_date,
            location_name,
            temp_max,
            temp_min,
            precipitation_mm,
            humidity,
            wind_speed_kph,
            weather_desc
        ))
        new_weather_id = cursor.fetchone()[0]
        conn.commit()

        stored_weather = {
            "weather_id": new_weather_id,
            "record_date": current_date,
            "location": location_name,
            "temperature_max_celsius": temp_max,
            "temperature_min_celsius": temp_min,
            "precipitation_mm": precipitation_mm,
            "humidity_percentage": humidity,
            "wind_speed_kph": wind_speed_kph,
            "weather_description": weather_desc
        }
        return stored_weather
    except requests.exceptions.RequestException as req_err:
        print(f"Error fetching from OpenWeatherMap: {req_err}")
        # Re-raise with 502 Bad Gateway for external API issues
        raise HTTPException(status_code=502, detail=f"Failed to fetch weather data from external API: {req_err}")
    except Error as db_err:
        print(f"Database error storing weather: {db_err}")
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {db_err}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")
    finally:
        close_db_connection(conn)

@app.get("/weather/latest/", response_model=Weather)
async def get_latest_weather_data():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                weather_id, record_date, location,
                temperature_max_celsius, temperature_min_celsius,
                precipitation_mm, humidity_percentage, wind_speed_kph, weather_description
            FROM weather_data
            ORDER BY record_date DESC
            LIMIT 1
        """)
        weather_data = cursor.fetchone()

        if weather_data is None:
            raise HTTPException(status_code=404, detail="No weather data found. Please fetch and store some first.")

        if 'record_date' in weather_data and isinstance(weather_data['record_date'], date):
            weather_data['record_date'] = weather_data['record_date'].strftime('%Y-%m-%d')

        return weather_data
    except Error as e:
        print(f"Error fetching latest weather: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/yields/", response_model=List[Yield])
async def get_all_yields():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                y.yield_id, y.crop_id, c.crop_name, y.harvest_date, y.actual_yield,
                y.unit, y.field_location, y.notes
            FROM yields y
            JOIN crops c ON y.crop_id = c.crop_id
            ORDER BY y.harvest_date DESC
        """)
        yields_data = cursor.fetchall()

        for record in yields_data:
            if isinstance(record.get('harvest_date'), date):
                record['harvest_date'] = record['harvest_date'].strftime('%Y-%m-%d')
        return yields_data
    except Error as e:
        print(f"Error fetching yields: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/yields/{yield_id}", response_model=Yield)
async def get_yield_by_id(yield_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                y.yield_id, y.crop_id, c.crop_name, y.harvest_date, y.actual_yield,
                y.unit, y.field_location, y.notes
            FROM yields y
            JOIN crops c ON y.crop_id = c.crop_id
            WHERE y.yield_id = %s
        """, (yield_id,))
        yield_data = cursor.fetchone()

        if yield_data is None:
            raise HTTPException(status_code=404, detail="Yield record not found")

        if isinstance(yield_data.get('harvest_date'), date):
            yield_data['harvest_date'] = yield_data['harvest_date'].strftime('%Y-%m-%d')
        return yield_data
    except Error as e:
        print(f"Error fetching yield by ID: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)


@app.post("/yields/", response_model=Yield)
async def create_yield(yield_record: YieldCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        INSERT INTO yields (crop_id, harvest_date, actual_yield, unit, field_location, notes)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING yield_id;
        """
        cursor.execute(query, (
            yield_record.crop_id,
            yield_record.harvest_date,
            yield_record.actual_yield,
            yield_record.unit,
            yield_record.field_location,
            yield_record.notes
        ))
        new_yield_id = cursor.fetchone()[0]
        conn.commit()

        crop_name = None
        crop_cursor = conn.cursor()
        crop_cursor.execute("SELECT crop_name FROM crops WHERE crop_id = %s", (yield_record.crop_id,))
        fetched_crop = crop_cursor.fetchone()
        if fetched_crop:
            crop_name = fetched_crop[0]


        return Yield(
            yield_id=new_yield_id,
            crop_id=yield_record.crop_id,
            crop_name=crop_name,
            harvest_date=yield_record.harvest_date,
            actual_yield=yield_record.actual_yield,
            unit=yield_record.unit,
            field_location=yield_record.field_location,
            notes=yield_record.notes
        )
    except Error as e:
        print(f"Error creating yield: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.put("/yields/{yield_id}", response_model=Yield)
async def update_yield(yield_id: int, yield_record: YieldCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        UPDATE yields
        SET crop_id = %s, harvest_date = %s, actual_yield = %s, unit = %s, field_location = %s, notes = %s
        WHERE yield_id = %s
        """
        cursor.execute(query, (
            yield_record.crop_id,
            yield_record.harvest_date,
            yield_record.actual_yield,
            yield_record.unit,
            yield_record.field_location,
            yield_record.notes,
            yield_id
        ))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Yield record not found")

        crop_name = None
        crop_cursor = conn.cursor()
        crop_cursor.execute("SELECT crop_name FROM crops WHERE crop_id = %s", (yield_record.crop_id,))
        fetched_crop = crop_cursor.fetchone()
        if fetched_crop:
            crop_name = fetched_crop[0]

        return Yield(
            yield_id=yield_id,
            crop_id=yield_record.crop_id,
            crop_name=crop_name,
            harvest_date=yield_record.harvest_date,
            actual_yield=yield_record.actual_yield,
            unit=yield_record.unit,
            field_location=yield_record.field_location,
            notes=yield_record.notes
        )
    except Error as e:
        print(f"Error updating yield: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.delete("/yields/{yield_id}", status_code=204)
async def delete_yield(yield_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        cursor.execute("DELETE FROM yields WHERE yield_id = %s", (yield_id,))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Yield record not found")
        return {"message": "Yield record deleted successfully"}
    except Error as e:
        print(f"Error deleting yield: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/soil_readings/", response_model=List[SoilReading])
async def get_all_soil_readings():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                sr.reading_id, sr.crop_id, c.crop_name, sr.reading_date,
                sr.soil_moisture_percentage, sr.ph_level, sr.nitrogen_level_ppm,
                sr.phosphorus_level_ppm, sr.potassium_level_ppm, sr.notes
            FROM soil_readings sr
            LEFT JOIN crops c ON sr.crop_id = c.crop_id
            ORDER BY sr.reading_date DESC;
        """)
        soil_data = cursor.fetchall()

        for record in soil_data:
            if isinstance(record.get('reading_date'), date):
                record['reading_date'] = record['reading_date'].strftime('%Y-%m-%d')
        return soil_data
    except Error as e:
        print(f"Error fetching soil readings: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/soil_readings/{reading_id}", response_model=SoilReading)
async def get_soil_reading_by_id(reading_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                sr.reading_id, sr.crop_id, c.crop_name, sr.reading_date,
                sr.soil_moisture_percentage, sr.ph_level, sr.nitrogen_level_ppm,
                sr.phosphorus_level_ppm, sr.potassium_level_ppm, sr.notes
            FROM soil_readings sr
            LEFT JOIN crops c ON sr.crop_id = c.crop_id
            WHERE sr.reading_id = %s;
        """, (reading_id,))
        soil_data = cursor.fetchone()

        if soil_data is None:
            raise HTTPException(status_code=404, detail="Soil reading not found")

        if isinstance(soil_data.get('reading_date'), date):
            soil_data['reading_date'] = soil_data['reading_date'].strftime('%Y-%m-%d')
        return soil_data
    except Error as e:
        print(f"Error fetching soil reading by ID: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.post("/soil_readings/", response_model=SoilReading)
async def create_soil_reading(reading: SoilReadingCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        INSERT INTO soil_readings (
            crop_id, reading_date, soil_moisture_percentage, ph_level,
            nitrogen_level_ppm, phosphorus_level_ppm, potassium_level_ppm, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING reading_id;
        """
        cursor.execute(query, (
            reading.crop_id,
            reading.reading_date,
            reading.soil_moisture_percentage,
            reading.ph_level,
            reading.nitrogen_level_ppm,
            reading.phosphorus_level_ppm,
            reading.potassium_level_ppm,
            reading.notes
        ))
        new_reading_id = cursor.fetchone()[0]
        conn.commit()

        crop_name = None
        if reading.crop_id:
            crop_cursor = conn.cursor()
            crop_cursor.execute("SELECT crop_name FROM crops WHERE crop_id = %s", (reading.crop_id,))
            fetched_crop = crop_cursor.fetchone()
            if fetched_crop:
                crop_name = fetched_crop[0]

        return SoilReading(
            reading_id=new_reading_id,
            crop_name=crop_name,
            **reading.dict(exclude_unset=True)
        )
    except Error as e:
        print(f"Error creating soil reading: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.put("/soil_readings/{reading_id}", response_model=SoilReading)
async def update_soil_reading(reading_id: int, reading: SoilReadingCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        UPDATE soil_readings
        SET crop_id = %s, reading_date = %s, soil_moisture_percentage = %s,
            ph_level = %s, nitrogen_level_ppm = %s, phosphorus_level_ppm = %s,
            potassium_level_ppm = %s, notes = %s
        WHERE reading_id = %s
        """
        cursor.execute(query, (
            reading.crop_id,
            reading.reading_date,
            reading.soil_moisture_percentage,
            reading.ph_level,
            reading.nitrogen_level_ppm,
            reading.phosphorus_level_ppm,
            reading.potassium_level_ppm,
            reading.notes,
            reading_id
        ))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Soil reading not found")

        crop_name = None
        if reading.crop_id:
            crop_cursor = conn.cursor()
            crop_cursor.execute("SELECT crop_name FROM crops WHERE crop_id = %s", (reading.crop_id,))
            fetched_crop = crop_cursor.fetchone()
            if fetched_crop:
                crop_name = fetched_crop[0]

        return SoilReading(
            reading_id=reading_id,
            crop_name=crop_name,
            **reading.dict(exclude_unset=True)
        )
    except Error as e:
        print(f"Error updating soil reading: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.delete("/soil_readings/{reading_id}", status_code=204)
async def delete_soil_reading(reading_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        cursor.execute("DELETE FROM soil_readings WHERE reading_id = %s", (reading_id,))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Soil reading not found")
        return {"message": "Soil reading deleted successfully"}
    except Error as e:
        print(f"Error deleting soil reading: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/inputs/", response_model=List[InputUsage])
async def get_all_inputs():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                iu.input_id, iu.crop_id, c.crop_name, iu.usage_date,
                iu.input_type, iu.input_name, iu.quantity_used, iu.unit,
                iu.field_location, iu.notes
            FROM input_usage iu
            LEFT JOIN crops c ON iu.crop_id = c.crop_id
            ORDER BY iu.usage_date DESC;
        """)
        inputs_data = cursor.fetchall()

        for record in inputs_data:
            if isinstance(record.get('usage_date'), date):
                record['usage_date'] = record['usage_date'].strftime('%Y-%m-%d')
        return inputs_data
    except Error as e:
        print(f"Error fetching inputs: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/inputs/{input_id}", response_model=InputUsage)
async def get_input_by_id(input_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                iu.input_id, iu.crop_id, c.crop_name, iu.usage_date,
                iu.input_type, iu.input_name, iu.quantity_used, iu.unit,
                iu.field_location, iu.notes
            FROM input_usage iu
            LEFT JOIN crops c ON iu.crop_id = c.crop_id
            WHERE iu.input_id = %s;
        """, (input_id,))
        input_data = cursor.fetchone()

        if input_data is None:
            raise HTTPException(status_code=404, detail="Input record not found")

        if isinstance(input_data.get('usage_date'), date):
            input_data['usage_date'] = input_data['usage_date'].strftime('%Y-%m-%d')
        return input_data
    except Error as e:
        print(f"Error fetching input by ID: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.post("/inputs/", response_model=InputUsage)
async def create_input_usage(input_record: InputUsageCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        INSERT INTO input_usage (
            crop_id, usage_date, input_type, input_name,
            quantity_used, unit, field_location, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING input_id;
        """
        cursor.execute(query, (
            input_record.crop_id,
            input_record.usage_date,
            input_record.input_type,
            input_record.input_name,
            input_record.quantity_used,
            input_record.unit,
            input_record.field_location,
            input_record.notes
        ))
        new_input_id = cursor.fetchone()[0]
        conn.commit()

        crop_name = None
        if input_record.crop_id:
            crop_cursor = conn.cursor()
            crop_cursor.execute("SELECT crop_name FROM crops WHERE crop_id = %s", (input_record.crop_id,))
            fetched_crop = crop_cursor.fetchone()
            if fetched_crop:
                crop_name = fetched_crop[0]

        return InputUsage(
            input_id=new_input_id,
            crop_name=crop_name,
            **input_record.dict(exclude_unset=True)
        )
    except Error as e:
        print(f"Error creating input usage: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.put("/inputs/{input_id}", response_model=InputUsage)
async def update_input_usage(input_id: int, input_record: InputUsageCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        UPDATE input_usage
        SET crop_id = %s, usage_date = %s, input_type = %s, input_name = %s,
            quantity_used = %s, unit = %s, field_location = %s, notes = %s
        WHERE input_id = %s
        """
        cursor.execute(query, (
            input_record.crop_id,
            input_record.usage_date,
            input_record.input_type,
            input_record.input_name,
            input_record.quantity_used,
            input_record.unit,
            input_record.field_location,
            input_record.notes,
            input_id
        ))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Input record not found")

        crop_name = None
        if input_record.crop_id:
            crop_cursor = conn.cursor()
            crop_cursor.execute("SELECT crop_name FROM crops WHERE crop_id = %s", (input_record.crop_id,))
            fetched_crop = crop_cursor.fetchone()
            if fetched_crop:
                crop_name = fetched_crop[0]

        return InputUsage(
            input_id=input_id,
            crop_name=crop_name,
            **input_record.dict(exclude_unset=True)
        )
    except Error as e:
        print(f"Error updating input usage: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.delete("/inputs/{input_id}", status_code=204)
async def delete_input_usage(input_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        cursor.execute("DELETE FROM input_usage WHERE input_id = %s", (input_id,))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Input record not found")
        return {"message": "Input record deleted successfully"}
    except Error as e:
        print(f"Error deleting input usage: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

# New API Endpoints for Phase 8: Enhanced Reporting

@app.get("/reports/total_yield_by_crop/", response_model=List[dict])
async def get_total_yield_by_crop():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                c.crop_name,
                SUM(y.actual_yield) AS total_yield,
                y.unit -- Assuming unit is consistent per crop or we pick one
            FROM yields y
            JOIN crops c ON y.crop_id = c.crop_id
            GROUP BY c.crop_name, y.unit
            ORDER BY total_yield DESC;
        """)
        total_yields = cursor.fetchall()
        # Ensure total_yield is float for JSON serialization
        for record in total_yields:
            if 'total_yield' in record and record['total_yield'] is not None:
                record['total_yield'] = float(record['total_yield'])
        return total_yields
    except Error as e:
        print(f"Error fetching total yield by crop: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/reports/average_soil_parameters/", response_model=dict)
async def get_average_soil_parameters():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                AVG(soil_moisture_percentage) AS avg_moisture,
                AVG(ph_level) AS avg_ph,
                AVG(nitrogen_level_ppm) AS avg_nitrogen,
                AVG(phosphorus_level_ppm) AS avg_phosphorus,
                AVG(potassium_level_ppm) AS avg_potassium
            FROM soil_readings;
        """)
        avg_params = cursor.fetchone()

        if avg_params is None or all(value is None for value in avg_params.values()):
            return {
                "avg_moisture": None, "avg_ph": None, "avg_nitrogen": None,
                "avg_phosphorus": None, "avg_potassium": None
            }

        # Convert Decimal values to float for JSON serialization
        for key, value in avg_params.items():
            if value is not None:
                avg_params[key] = float(value)

        return avg_params
    except Error as e:
        print(f"Error fetching average soil parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

# New API Endpoint for Phase 9: Farm Advice
@app.get("/advice/farm_health/", response_model=List[FarmAdvice])
async def get_farm_health_advice():
    conn = None
    advice_list = []
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Fetch latest soil reading
        cursor.execute("""
            SELECT
                soil_moisture_percentage, ph_level,
                nitrogen_level_ppm, phosphorus_level_ppm, potassium_level_ppm
            FROM soil_readings
            ORDER BY reading_date DESC
            LIMIT 1;
        """)
        latest_soil_reading = cursor.fetchone()

        if not latest_soil_reading:
            advice_list.append(FarmAdvice(message="No soil readings available. Please add some to get soil health advice.", type="info"))
        else:
            # Advice based on Soil Moisture
            moisture = latest_soil_reading.get('soil_moisture_percentage')
            if moisture is not None:
                if moisture < 40: # Threshold for low moisture
                    advice_list.append(FarmAdvice(message=f"Soil moisture is low ({moisture}%). Consider immediate irrigation.", type="warning"))
                elif moisture > 80: # Threshold for very high moisture
                    advice_list.append(FarmAdvice(message=f"Soil moisture is high ({moisture}%). Ensure proper drainage to avoid root rot.", type="info"))
                else:
                    advice_list.append(FarmAdvice(message=f"Soil moisture is optimal ({moisture}%).", type="success"))
            else:
                advice_list.append(FarmAdvice(message="Soil moisture data is missing from the latest reading.", type="info"))

            # Advice based on pH Level
            ph = latest_soil_reading.get('ph_level')
            if ph is not None:
                if ph < 5.5:
                    advice_list.append(FarmAdvice(message=f"Soil pH is very acidic ({ph}). Consider liming to raise pH.", type="warning"))
                elif 5.5 <= ph < 6.0:
                    advice_list.append(FarmAdvice(message=f"Soil pH is slightly acidic ({ph}). Monitor and consider small adjustments.", type="info"))
                elif ph > 7.5:
                    advice_list.append(FarmAdvice(message=f"Soil pH is alkaline ({ph}). Consider amendments to lower pH.", type="warning"))
                else: # 6.0 to 7.5
                    advice_list.append(FarmAdvice(message=f"Soil pH is optimal ({ph}).", type="success"))
            else:
                advice_list.append(FarmAdvice(message="Soil pH data is missing from the latest reading.", type="info"))

            # Advice based on NPK levels (simplified thresholds)
            nitrogen = latest_soil_reading.get('nitrogen_level_ppm')
            phosphorus = latest_soil_reading.get('phosphorus_level_ppm')
            potassium = latest_soil_reading.get('potassium_level_ppm')

            if nitrogen is not None and nitrogen < 50:
                advice_list.append(FarmAdvice(message=f"Nitrogen level is low ({nitrogen} ppm). Consider nitrogen-rich fertilizer.", type="warning"))
            elif nitrogen is None:
                advice_list.append(FarmAdvice(message="Nitrogen data is missing from the latest reading.", type="info"))

            if phosphorus is not None and phosphorus < 20:
                advice_list.append(FarmAdvice(message=f"Phosphorus level is low ({phosphorus} ppm). Consider phosphorus-rich fertilizer.", type="warning"))
            elif phosphorus is None:
                advice_list.append(FarmAdvice(message="Phosphorus data is missing from the latest reading.", type="info"))

            if potassium is not None and potassium < 100:
                advice_list.append(FarmAdvice(message=f"Potassium level is low ({potassium} ppm). Consider potassium-rich fertilizer.", type="warning"))
            elif potassium is None:
                advice_list.append(FarmAdvice(message="Potassium data is missing from the latest reading.", type="info"))

        # Add a general health message if no warnings/infos and data exists
        if not advice_list or (len(advice_list) == 1 and advice_list[0].type == "info"):
            advice_list.append(FarmAdvice(message="Farm health appears good based on available data!", type="success"))


        return advice_list
    except Error as e:
        print(f"Error fetching farm health advice: {e}")
        raise HTTPException(status_code=500, detail=f"Database error fetching advice: {e}")
    finally:
        close_db_connection(conn)

# New API Endpoints for Phase 10: Input Cost Tracking

@app.get("/input_costs/", response_model=List[InputCost])
async def get_all_input_costs():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                ic.cost_id, ic.input_id, iu.input_type, ic.cost_date,
                ic.item_name, ic.cost_amount, ic.currency, ic.notes
            FROM input_costs ic
            LEFT JOIN input_usage iu ON ic.input_id = iu.input_id
            ORDER BY ic.cost_date DESC;
        """)
        costs_data = cursor.fetchall()

        for record in costs_data:
            if isinstance(record.get('cost_date'), date):
                record['cost_date'] = record['cost_date'].strftime('%Y-%m-%d')
            if 'cost_amount' in record and record['cost_amount'] is not None:
                record['cost_amount'] = float(record['cost_amount'])
        return costs_data
    except Error as e:
        print(f"Error fetching input costs: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/input_costs/{cost_id}", response_model=InputCost)
async def get_input_cost_by_id(cost_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                ic.cost_id, ic.input_id, iu.input_type, ic.cost_date,
                ic.item_name, ic.cost_amount, ic.currency, ic.notes
            FROM input_costs ic
            LEFT JOIN input_usage iu ON ic.input_id = iu.input_id
            WHERE ic.cost_id = %s;
        """, (cost_id,))
        cost_data = cursor.fetchone()

        if cost_data is None:
            raise HTTPException(status_code=404, detail="Input cost record not found")

        if isinstance(cost_data.get('cost_date'), date):
            cost_data['cost_date'] = cost_data['cost_date'].strftime('%Y-%m-%d')
        if 'cost_amount' in cost_data and cost_data['cost_amount'] is not None:
            cost_data['cost_amount'] = float(cost_data['cost_amount'])
        return cost_data
    except Error as e:
        print(f"Error fetching input cost by ID: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.post("/input_costs/", response_model=InputCost)
async def create_input_cost(cost_record: InputCostCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        INSERT INTO input_costs (
            input_id, cost_date, item_name, cost_amount, currency, notes
        ) VALUES (%s, %s, %s, %s, %s, %s) RETURNING cost_id;
        """
        cursor.execute(query, (
            cost_record.input_id,
            cost_record.cost_date,
            cost_record.item_name,
            cost_record.cost_amount,
            cost_record.currency,
            cost_record.notes
        ))
        new_cost_id = cursor.fetchone()[0]
        conn.commit()

        input_type = None
        if cost_record.input_id:
            input_cursor = conn.cursor()
            input_cursor.execute("SELECT input_type FROM input_usage WHERE input_id = %s", (cost_record.input_id,))
            fetched_input = input_cursor.fetchone()
            if fetched_input:
                input_type = fetched_input[0]

        return InputCost(
            cost_id=new_cost_id,
            input_type=input_type,
            **cost_record.dict(exclude_unset=True)
        )
    except Error as e:
        print(f"Error creating input cost: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.put("/input_costs/{cost_id}", response_model=InputCost)
async def update_input_cost(cost_id: int, cost_record: InputCostCreate):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        query = """
        UPDATE input_costs
        SET input_id = %s, cost_date = %s, item_name = %s,
            cost_amount = %s, currency = %s, notes = %s
        WHERE cost_id = %s
        """
        cursor.execute(query, (
            cost_record.input_id,
            cost_record.cost_date,
            cost_record.item_name,
            cost_record.cost_amount,
            cost_record.currency,
            cost_record.notes,
            cost_id
        ))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Input cost record not found")

        input_type = None
        if cost_record.input_id:
            input_cursor = conn.cursor()
            input_cursor.execute("SELECT input_type FROM input_usage WHERE input_id = %s", (cost_record.input_id,))
            fetched_input = input_cursor.fetchone()
            if fetched_input:
                input_type = fetched_input[0]

        return InputCost(
            cost_id=cost_id,
            input_type=input_type,
            **cost_record.dict(exclude_unset=True)
        )
    except Error as e:
        print(f"Error updating input cost: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.delete("/input_costs/{cost_id}", status_code=204)
async def delete_input_cost(cost_id: int):
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor()
        cursor.execute("DELETE FROM input_costs WHERE cost_id = %s", (cost_id,))
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Input cost record not found")
        return {"message": "Input cost record deleted successfully"}
    except Error as e:
        print(f"Error deleting input cost: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

@app.get("/reports/total_input_cost_by_type/", response_model=List[dict])
async def get_total_input_cost_by_type():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                COALESCE(iu.input_type, ic.item_name) AS category,
                SUM(ic.cost_amount) AS total_cost,
                ic.currency
            FROM input_costs ic
            LEFT JOIN input_usage iu ON ic.input_id = iu.input_id
            GROUP BY COALESCE(iu.input_type, ic.item_name), ic.currency
            ORDER BY total_cost DESC;
        """)
        total_costs = cursor.fetchall()
        for record in total_costs:
            if 'total_cost' in record and record['total_cost'] is not None:
                record['total_cost'] = float(record['total_cost'])
        return total_costs
    except Error as e:
        print(f"Error fetching total input cost by type: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

# New API Endpoint for Phase 11: Yield Forecasting
@app.get("/reports/yield_forecast/", response_model=List[CropYieldForecast])
async def get_yield_forecast():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = conn.cursor(cursor_factory=RealDictCursor)
        # Calculate average yield for each crop
        cursor.execute("""
            SELECT
                c.crop_id,
                c.crop_name,
                AVG(y.actual_yield) AS average_yield,
                y.unit
            FROM crops c
            LEFT JOIN yields y ON c.crop_id = y.crop_id
            GROUP BY c.crop_id, c.crop_name, y.unit
            ORDER BY c.crop_name ASC;
        """)
        forecasts_data = cursor.fetchall()

        # Ensure average_yield is float for JSON serialization
        for record in forecasts_data:
            if 'average_yield' in record and record['average_yield'] is not None:
                record['average_yield'] = float(record['average_yield'])
        return forecasts_data
    except Error as e:
        print(f"Error fetching yield forecast: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        close_db_connection(conn)

# Helper function to convert query results to CSV string
def convert_to_csv(data: List[Dict[str, Any]]) -> str:
    if not data:
        return ""
    output = io.StringIO()
    # Sort keys to ensure consistent header order
    fieldnames = sorted(data[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in data:
        # Convert date objects to string for CSV compatibility
        for key, value in row.items():
            if isinstance(value, (datetime, date)):
                row[key] = value.strftime('%Y-%m-%d')
            elif isinstance(value, float):
                row[key] = f"{value:.2f}" # Format floats to 2 decimal places
            elif value is None:
                row[key] = "" # Replace None with empty string
        writer.writerow(row)
    return output.getvalue()

# New API Endpoint for Phase 12: Data Export
@app.get("/reports/export_all_data/csv", response_model=Dict[str, str])
async def export_all_data_csv():
    conn = None
    try:
        conn = create_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        exported_data = {}

        # Export Crops
        cursor.execute("SELECT * FROM crops ORDER BY crop_id ASC;")
        crops_data = cursor.fetchall()
        exported_data['crops.csv'] = convert_to_csv(crops_data)

        # Export Yields
        cursor.execute("SELECT * FROM yields ORDER BY yield_id ASC;")
        yields_data = cursor.fetchall()
        exported_data['yields.csv'] = convert_to_csv(yields_data)

        # Export Soil Readings
        cursor.execute("SELECT * FROM soil_readings ORDER BY reading_id ASC;")
        soil_readings_data = cursor.fetchall()
        exported_data['soil_readings.csv'] = convert_to_csv(soil_readings_data)

        # Export Input Usage
        cursor.execute("SELECT * FROM input_usage ORDER BY input_id ASC;")
        input_usage_data = cursor.fetchall()
        exported_data['input_usage.csv'] = convert_to_csv(input_usage_data)

        # Export Input Costs
        cursor.execute("SELECT * FROM input_costs ORDER BY cost_id ASC;")
        input_costs_data = cursor.fetchall()
        exported_data['input_costs.csv'] = convert_to_csv(input_costs_data)

        # Export Weather Data
        cursor.execute("SELECT * FROM weather_data ORDER BY weather_id ASC;")
        weather_data = cursor.fetchall()
        exported_data['weather_data.csv'] = convert_to_csv(weather_data)

        return exported_data
    except Error as e:
        print(f"Error exporting data: {e}")
        raise HTTPException(status_code=500, detail=f"Database error during export: {e}")
    finally:
        close_db_connection(conn)
