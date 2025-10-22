from fastapi import APIRouter, HTTPException
from models.pydantic import SimulationRequest, SimulationResponse
from services.simulation_service import run_inventory_simulation

router = APIRouter()

@router.post("/simulate", response_model=SimulationResponse)
def simulate_inventory(request: SimulationRequest) -> SimulationResponse:
    """ Run inventory simulation with custom parameters
    Now includes season and festival impact on demand
    Properly handles start_day and end_day:
    - start_day: 0 = Jan 1, 31 = Feb 1, etc.
    - end_day: Optional, if not provided uses simulation_days
    - Example: start_day=31, end_day=100 → Feb 1 to Apr 10 (70 days)
    """
    try:
        results = run_inventory_simulation(request)
        return results
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Simulation error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")