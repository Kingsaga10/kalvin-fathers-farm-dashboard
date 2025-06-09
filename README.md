# Kalvin Fathers Farm Dashboard

A comprehensive web-based application designed to help farmers efficiently manage and monitor various aspects of their farm operations. From tracking crop yields and soil health to managing input usage and costs, the dashboard provides a centralized system for data entry, visualization, and reporting.

## 🌾 Overview

This tool aims to empower farmers with data-driven insights to optimize productivity and make informed decisions through:

- **Real-time monitoring** of crop performance and soil health
- **Cost tracking** for inputs and farm operations
- **Weather integration** for climate-based farming advice
- **Data visualization** with interactive charts and trends
- **Comprehensive reporting** with CSV export capabilities

## ✨ Features

### 🌱 Crop Management
- Add, view, update, and delete crop records
- Track planting seasons and expected yields
- Comprehensive crop database management

### 📊 Yield Tracking & Analytics
- Record actual crop yields with harvest dates and locations
- Visualize historical yield trends with interactive charts
- Simple yield forecasting based on historical averages

### 🌍 Soil Monitoring
- Log soil readings (moisture, pH, NPK levels)
- View average soil parameters across the farm
- Track soil health over time

### 🧪 Input Management
- **Usage Tracking**: Record fertilizers, pesticides, fuel, and other inputs
- **Cost Tracking**: Monitor financial expenses for all farm inputs
- Detailed quantity and date tracking

### 🌤️ Weather Integration
- Fetch real-time weather data for your farm location
- Receive automated farm health advice based on conditions
- Climate-based recommendations

### 📈 Data Visualization
- Dynamic charts powered by Google Charts API
- Yield trends and crop performance analytics
- Input cost analysis and soil parameter tracking

### 📋 Reporting & Export
- Export all farm data to separate CSV files
- Comprehensive data backup and analysis capabilities
- External integration support

### 📱 User Experience
- Responsive design for desktop and mobile
- Custom modal dialogs for improved UX
- Intuitive navigation and data entry

## 🛠️ Technology Stack

### Frontend
- **HTML5** - Web content structure
- **CSS3** - Responsive styling and design
- **JavaScript (ES6+)** - Interactive functionality
- **Google Charts API** - Data visualization
- **Font Awesome** - Icon library

### Backend
- **FastAPI** - High-performance Python web framework
- **Pydantic** - Data validation and settings management
- **PostgreSQL** - Relational database
- **Psycopg2** - PostgreSQL Python adapter

### Development Tools
- **Uvicorn** - ASGI server for FastAPI
- **python-dotenv** - Environment variable management
- **Requests** - HTTP client for external APIs

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- PostgreSQL
- OpenWeatherMap API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/kalvin_fathers_farm_dashboard.git
   cd kalvin_fathers_farm_dashboard
   ```

2. **Set up Python environment**
   ```bash
   python -m venv venv

   # Windows
   .\venv\Scripts\activate

   # macOS/Linux
   source venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Database setup**
   - Install PostgreSQL from [postgresql.org](https://postgresql.org)
   - Create database: `CREATE DATABASE farm_dashboard_db;`
   - Run the SQL schema (see Database Schema section below)

4. **Configure environment**
   ```bash
   # Create backend/.env
   echo 'OPENWEATHER_API_KEY="YOUR_API_KEY_HERE"' > backend/.env

   # Create backend/db_config.py
   echo 'DATABASE_URL = "postgresql://username:password@localhost:5432/farm_dashboard_db"' > backend/db_config.py
   ```

5. **Start the servers**
   ```bash
   # Backend (Terminal 1)
   cd backend
   uvicorn main:app --reload --host 127.0.0.1 --port 8000

   # Frontend (Terminal 2)
   cd frontend
   python -m http.server 8001
   ```

6. **Access the application**
   Open your browser and navigate to: `http://127.0.0.1:8001`

## 📦 Dependencies

Create a `requirements.txt` file with:

```txt
fastapi==0.111.0
uvicorn==0.30.1
pydantic==2.7.4
psycopg2-binary==2.9.9
python-dotenv==1.0.1
requests==2.32.3
```

## 🗄️ Database Schema

<details>
<summary>Click to expand SQL schema</summary>

```sql
-- Crops table
CREATE TABLE IF NOT EXISTS crops (
    crop_id SERIAL PRIMARY KEY,
    crop_name VARCHAR(255) NOT NULL UNIQUE,
    planting_season VARCHAR(100),
    expected_yield_per_acre DECIMAL(10, 2)
);

-- Weather data table
CREATE TABLE IF NOT EXISTS weather_data (
    weather_id SERIAL PRIMARY KEY,
    record_date DATE NOT NULL UNIQUE,
    location VARCHAR(255),
    temperature_max_celsius DECIMAL(5, 2),
    temperature_min_celsius DECIMAL(5, 2),
    precipitation_mm DECIMAL(6, 2),
    humidity_percentage DECIMAL(5, 2),
    wind_speed_kph DECIMAL(6, 2),
    weather_description VARCHAR(255)
);

-- Yields table
CREATE TABLE IF NOT EXISTS yields (
    yield_id SERIAL PRIMARY KEY,
    crop_id INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    harvest_date DATE NOT NULL,
    actual_yield DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    field_location VARCHAR(255),
    notes TEXT
);

-- Soil readings table
CREATE TABLE IF NOT EXISTS soil_readings (
    reading_id SERIAL PRIMARY KEY,
    crop_id INTEGER REFERENCES crops(crop_id) ON DELETE SET NULL,
    reading_date DATE NOT NULL,
    soil_moisture_percentage DECIMAL(5, 2),
    ph_level DECIMAL(4, 2),
    nitrogen_level_ppm DECIMAL(10, 2),
    phosphorus_level_ppm DECIMAL(10, 2),
    potassium_level_ppm DECIMAL(10, 2),
    notes TEXT
);

-- Input usage table
CREATE TABLE IF NOT EXISTS input_usage (
    input_id SERIAL PRIMARY KEY,
    crop_id INTEGER REFERENCES crops(crop_id) ON DELETE SET NULL,
    usage_date DATE NOT NULL,
    input_type VARCHAR(100) NOT NULL,
    input_name VARCHAR(255) NOT NULL,
    quantity_used DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    field_location VARCHAR(255),
    notes TEXT
);

-- Input costs table
CREATE TABLE IF NOT EXISTS input_costs (
    cost_id SERIAL PRIMARY KEY,
    input_id INTEGER REFERENCES input_usage(input_id) ON DELETE SET NULL,
    cost_date DATE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    cost_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    notes TEXT
);
```
</details>

## 📁 Project Structure

```
kalvin_fathers_farm_dashboard/
├── backend/
│   ├── main.py                     # FastAPI application
│   ├── database_connection.py      # Database logic
│   ├── db_config.py                # Database configuration
│   ├── .env                        # Environment variables
│   └── __init__.py
├── frontend/
│   ├── index.html                  # Main dashboard
│   ├── style.css                   # Styling
│   └── script.js                   # Frontend logic
├── venv/                           # Virtual environment
├── requirements.txt                # Python dependencies
└── README.md                       # This file
```

## 📖 Usage Guide

1. **Dashboard Navigation**: Use the main dashboard to access different sections
2. **Data Entry**: Fill out forms to add crops, yields, soil readings, and inputs
3. **Visualization**: View charts and trends in the analytics sections
4. **Weather Monitoring**: Check current conditions and receive advice
5. **Export Data**: Use the export feature to download CSV reports
6. **Data Management**: Edit or delete records using the action buttons

## 🔮 Future Enhancements

- **🤖 AI/ML Integration**: Advanced predictive analytics and yield forecasting
- **💰 Profitability Analysis**: Detailed financial reporting and ROI calculations
- **🗺️ Geospatial Features**: Interactive farm mapping and field visualization
- **📦 Inventory Management**: Stock tracking and automated reorder alerts
- **⏰ Task Management**: Farm task scheduling and labor tracking
- **🔐 User Authentication**: Multi-user support with role-based access
- **📱 Mobile App**: Native mobile application for field data collection

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Guidelines
- Follow PEP 8 style guide for Python code
- Write descriptive commit messages
- Include tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-username/kalvin_fathers_farm_dashboard/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## 🙏 Acknowledgments

- Built with love for the farming community
- Thanks to all contributors and supporters
- Special thanks to the open-source community

---

**Happy Farming! 🌾**