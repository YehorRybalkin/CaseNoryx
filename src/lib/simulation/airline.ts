import { BASE_ASSUMPTIONS, routePnl } from "@/lib/cases/airline/model";
import type { ScenarioResult } from "@/lib/cases/types";

export interface AirlineInputs {
  demandChange: number;
  fareChange: number;
  fuelPrice: number;
  otherCostChange: number;
  winterFrequency: number;
}

function metrics(p: ReturnType<typeof routePnl>) {
  return {
    passengers: p.passengers,
    loadFactor: p.loadFactor,
    breakEvenLf: p.breakEvenLf,
    revenue: p.revenue,
    contribution: p.contribution,
    operatingResult: p.operatingResult,
    runRateResult: p.operatingResult + p.oneOffs,
  };
}

export function simulateAirline(x: AirlineInputs): ScenarioResult {
  const scenario = routePnl({
    demandChange: x.demandChange / 100,
    fareChange: x.fareChange / 100,
    fuelPrice: x.fuelPrice,
    otherCostChange: x.otherCostChange / 100,
    winterFrequency: x.winterFrequency,
    includeOneOffs: true,
  });
  return {
    baseline: metrics(routePnl(BASE_ASSUMPTIONS)),
    scenario: metrics(scenario),
    notes: [
      "Baseline = management's year-round FY2026 plan at base demand, base fares and €850/t fuel.",
      "Passengers = min(demand, 95% of seats); demand above that is spilled.",
      "Winter = Nov–Mar. Setting winter frequency to 0 suspends the route; station costs fall to €12k/month and no aircraft cost is incurred (aircraft redeployed).",
      "Operating result includes one-off launch costs (€530k); run-rate result excludes them.",
      "Break-even load factor = (sector costs + fixed costs) / (seats × (average fare − per-passenger costs)).",
    ],
  };
}
