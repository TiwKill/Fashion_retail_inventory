from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routers import root, simulation
from services.data_service import init_data

app = FastAPI(title="Inventory Simulation API")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(root.router)
app.include_router(simulation.router)

# Initialize data on startup
@app.on_event("startup")
async def startup_event():
    init_data()

if __name__ == "__main__":
    print("🚀 Starting Inventory Simulation API with Season & Festival Analysis...")
    print("📍 API will be available at: http://localhost:8000")
    print("📖 API docs available at: http://localhost:8000/docs")
    print("\n🌦️ Season & Festival Features:")
    print(" - 12 months mapped to quarters and season types")
    print(" - 14 major festivals/holidays tracked")
    print(" - Festival multipliers affect daily demand (1.2x - 2.2x)")
    print(" - All data includes season and festival information")
    print("\n🔧 Date Range Handling:")
    print(" - start_day: Day of year (0=Jan 1, 31=Feb 1, 59=Mar 1, etc.)")
    print(" - end_day: Optional end day of year")
    print(" - Example: start_day=31, end_day=100 → Feb 1 to Apr 10")
    uvicorn.run(app, host="0.0.0.0", port=8000)