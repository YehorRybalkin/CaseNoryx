/**
 * Case 3 — Aerivia Regional (synthetic): proposed Aarhus (AAR) – Málaga (AGP) route.
 * FY2026 plan, 12 months. Demand is derived from market history × target share.
 */
import { round } from "@/lib/analytics/numbers";
import { createRng, monthRange } from "../random";

export const AIRLINE_SEED = 4_411_2026;
export const PLAN_MONTHS = monthRange(2026, 1, 12);
export const SEATS = 112; // Embraer E190
export const BLOCK_HOURS_PER_SECTOR = 3.6;
export const WEEKS_PER_MONTH = [4.43, 4.0, 4.43, 4.29, 4.43, 4.29, 4.43, 4.43, 4.29, 4.43, 4.29, 4.43]; // days/7
export const MAX_LOAD_FACTOR = 0.95; // operational ceiling (no-shows, weight restrictions)
export const TARGET_SHARE = 0.34;
export const BASE_FUEL_PRICE = 850; // EUR per tonne
export const FUEL_BURN_T_PER_BH = 2.0;

export const UNIT_COSTS = {
  fuelPerBlockHour: FUEL_BURN_T_PER_BH * BASE_FUEL_PRICE,
  crewPerBlockHour: 640,
  maintenancePerBlockHour: 470,
  aircraftOwnershipPerBlockHour: 390,
  airportAtcPerDeparture: 2_950,
  passengerFees: 17.5,
  distributionHandlingPerPax: 9.5,
};
export const FIXED = {
  routeOverheadMonthly: 25_000, // sales, revenue management, admin
  stationMonthly: 36_000,
  stationSuspendedMonthly: 12_000,
  insuranceMonthly: 9_500,
  launchMarketingOneOff: 420_000,
  routeSetupOneOff: 110_000,
};

const SEASON = [0.48, 0.5, 0.72, 0.92, 1.12, 1.38, 1.62, 1.58, 1.22, 0.9, 0.5, 0.62];
const FARE = [136, 129, 152, 182, 202, 236, 262, 260, 214, 175, 133, 159];
const PLAN_FREQ = [3, 3, 3, 5, 6, 7, 7, 7, 6, 5, 3, 3];

export function generateAirlineData() {
  const rng = createRng(AIRLINE_SEED);
  const history = [] as { month: string; year: number; market_od_passengers: number; competitor_weekly_seats: number; market_avg_fare: number }[];
  for (const [i, ym] of monthRange(2024, 1, 24).entries()) {
    const m = i % 12;
    const growth = i >= 12 ? 1.045 : 1;
    history.push({
      month: ym,
      year: Number(ym.slice(0, 4)),
      market_od_passengers: Math.round(10_400 * SEASON[m] * growth * rng.noise(0.03)),
      competitor_weekly_seats: Math.round((m >= 3 && m <= 9 ? 1_320 : 560) * rng.noise(0.02)),
      market_avg_fare: round(FARE[m] * 1.04 * rng.noise(0.02), 2),
    });
  }
  const last = history.filter((h) => h.year === 2025);
  const forecast = PLAN_MONTHS.map((month, m) => {
    const market = last[m].market_od_passengers * 1.035; // 2026 market growth
    const base = Math.round(market * TARGET_SHARE);
    const sectors = Math.round(PLAN_FREQ[m] * 2 * WEEKS_PER_MONTH[m]);
    return {
      month,
      weekly_round_trips: PLAN_FREQ[m],
      sectors,
      seats_per_sector: SEATS,
      seat_capacity: sectors * SEATS,
      demand_base: base,
      demand_low: Math.round(base * 0.85),
      demand_high: Math.round(base * 1.12),
      avg_fare_base: FARE[m],
      competitor_lowest_fare: round(FARE[m] * 0.82 * rng.noise(0.03), 2),
    };
  });
  const unitCosts = [
    { cost_item: "Fuel", basis: "per block hour", value: UNIT_COSTS.fuelPerBlockHour, unit: "EUR", note: `${FUEL_BURN_T_PER_BH} t/BH at €${BASE_FUEL_PRICE}/t jet fuel` },
    { cost_item: "Crew", basis: "per block hour", value: UNIT_COSTS.crewPerBlockHour, unit: "EUR", note: "2 pilots + 3 cabin crew incl. per diems" },
    { cost_item: "Maintenance reserves", basis: "per block hour", value: UNIT_COSTS.maintenancePerBlockHour, unit: "EUR", note: "Engine and airframe reserves" },
    { cost_item: "Aircraft ownership", basis: "per block hour", value: UNIT_COSTS.aircraftOwnershipPerBlockHour, unit: "EUR", note: "Lease cost allocated by block hours; aircraft is redeployed (charter/wet-lease) when not flying the route" },
    { cost_item: "Airport & ATC charges", basis: "per departure", value: UNIT_COSTS.airportAtcPerDeparture, unit: "EUR", note: "Landing, parking, navigation (average of both ends)" },
    { cost_item: "Passenger charges", basis: "per passenger", value: UNIT_COSTS.passengerFees, unit: "EUR", note: "Passenger service and security charges" },
    { cost_item: "Distribution & handling", basis: "per passenger", value: UNIT_COSTS.distributionHandlingPerPax, unit: "EUR", note: "GDS/booking fees, ground handling" },
    { cost_item: "Block time", basis: "per sector", value: BLOCK_HOURS_PER_SECTOR, unit: "hours", note: "Scheduled gate-to-gate time AAR–AGP" },
  ];
  const fixedCosts = [
    { item: "Route overhead", amount: FIXED.routeOverheadMonthly, frequency: "Monthly while operating", note: "Sales, revenue management and admin allocated to the route" },
    { item: "Station costs (AGP)", amount: FIXED.stationMonthly, frequency: "Monthly while operating", note: `Drops to €${FIXED.stationSuspendedMonthly.toLocaleString("en-GB")} in suspended months` },
    { item: "Route insurance", amount: FIXED.insuranceMonthly, frequency: "Monthly", note: "Hull and liability allocation" },
    { item: "Launch marketing", amount: FIXED.launchMarketingOneOff, frequency: "One-off (year 1)", note: "Brand and route launch campaign" },
    { item: "Route set-up", amount: FIXED.routeSetupOneOff, frequency: "One-off (year 1)", note: "Slots, station set-up, crew training" },
  ];
  const fuelScenarios = [
    { scenario: "Low", jet_fuel_eur_per_tonne: 700, probability: 0.25 },
    { scenario: "Base", jet_fuel_eur_per_tonne: 850, probability: 0.5 },
    { scenario: "High", jet_fuel_eur_per_tonne: 1_020, probability: 0.25 },
  ];
  const surveys = [
    { question: "Would consider flying direct AAR–AGP", respondents: 1_240, share_yes: 0.61, note: "Online panel, Jutland residents" },
    { question: "Willing to pay a €25 premium vs. connecting via CPH", respondents: 1_240, share_yes: 0.38, note: "Stated preference (tends to overstate)" },
    { question: "Travel window: June–August", respondents: 1_240, share_yes: 0.57, note: "Leisure dominated" },
    { question: "Travel window: November–March", respondents: 1_240, share_yes: 0.14, note: "Mostly retirees / second homes" },
  ];
  return { history, forecast, unitCosts, fixedCosts, fuelScenarios, surveys };
}

export const airlineData = generateAirlineData();
