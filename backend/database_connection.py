# backend/database_connection.py (PostgreSQL)
import psycopg2
from psycopg2 import Error
from psycopg2.extras import RealDictCursor # To fetch results as dictionaries

# Database configuration - IMPORTANT: Replace with your actual PostgreSQL password
DB_CONFIG = {
    'host': '127.0.0.1',
    'database': 'farm_monitoring_db',
    'user': 'postgres', # Default PostgreSQL superuser
    'password': 'Jj0248485233', # <--- !!! REPLACE THIS !!!
    'port': '5432' # Default PostgreSQL port
}

def create_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    connection = None
    try:
        connection = psycopg2.connect(**DB_CONFIG)
        connection.autocommit = False # Ensure transactions are explicitly committed
        print("Successfully connected to PostgreSQL database.")
        cursor = connection.cursor()
        cursor.execute("SELECT current_database();")
        record = cursor.fetchone()
        print(f"Connected to database: {record[0]}")
        return connection
    except Error as e:
        print(f"Error connecting to PostgreSQL database: {e}")
        return None

def close_db_connection(connection):
    """Closes the database connection if it's open."""
    if connection: # psycopg2 connection objects don't have .is_connected()
        connection.close()
        print("PostgreSQL connection closed.")

if __name__ == "__main__":
    print("Attempting to connect to the database...")
    conn = create_db_connection()
    if conn:
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor) # Get results as dictionaries
            cursor.execute("SELECT crop_id, crop_name FROM crops LIMIT 5;")
            crops = cursor.fetchall()
            print("\nSample Crops:")
            for crop in crops:
                print(f"ID: {crop['crop_id']}, Name: {crop['crop_name']}")
            conn.commit() # Commit any implicit transactions if needed, though for SELECT it's fine.
        except Error as e:
            print(f"Error fetching data: {e}")
        finally:
            close_db_connection(conn)
    else:
        print("Failed to establish database connection.")
