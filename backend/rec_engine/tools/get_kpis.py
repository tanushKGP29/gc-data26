"""
Stub KPI tool for tests.
"""
import json
from dataclasses import dataclass
from typing import List

@dataclass
class Objective:
    kpi: str
    weight: float

@dataclass
class HardFilters:
    min_inventory: int
    def model_dump(self):
        return {"min_inventory": self.min_inventory}

@dataclass
class Config:
    active_campaign: str
    objectives: List[Objective]
    hard_filters: HardFilters


def _load_from_file() -> Config:
    return Config(
        active_campaign="demo_campaign",
        objectives=[Objective(kpi="ctr", weight=0.5), Objective(kpi="conversion", weight=0.5)],
        hard_filters=HardFilters(min_inventory=1),
    )


def get_kpis(_: dict = None) -> str:
    cfg = _load_from_file()
    return json.dumps({
        "campaign": cfg.active_campaign,
        "objectives": [{"kpi": o.kpi, "weight": o.weight} for o in cfg.objectives],
        "hard_filters": cfg.hard_filters.model_dump(),
    })

# Support .invoke pattern used in tests
get_kpis.invoke = lambda inputs=None: get_kpis(inputs)
