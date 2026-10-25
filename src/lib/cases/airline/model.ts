/** Route P&L model for the airline case. Used by analytics, simulator and grading. */
import { safeDivide } from "@/lib/analytics";
import { BLOCK_HOURS_PER_SECTOR, FIXED, FUEL_BURN_T_PER_BH, MAX_LOAD_FACTOR, UNIT_COSTS, WEEKS_PER_MONTH, airlineData } from "./data";

export interface RouteAssumptions {
  /** Relative change applied to base demand (−0.15 = −15%). */
  demandChange: number;
  /** Relative change applied to base fares. */
  fareChange: number;
  /** Jet fuel price, EUR per tonne. */
  fuelPrice: number;
  /** Relative change in crew, maintenance and airport costs. */
  otherCostChange: number;
  /** Weekly round trips in Nov–Mar; 0 = seasonal suspension. null = use plan schedule. */
  winterFrequency: number | null;
  /** Include one-off launch costs (year 1). */
  includeOneOffs: boolean;
}

export const BASE_ASSUMPTIONS: RouteAssumptions = { demandChange: 0, fareChange: 0, fuelPrice: 850, otherCostChange: 0, winterFrequency: null, includeOneOffs: true };
const WINTER = new Set([0, 1, 2, 10, 11]); // Jan, Feb, Mar, Nov, Dec

export interface MonthPnl {
  month: string;
  operating: boolean;
  sectors: number;
  seats: number;
  demand: number;
  passengers: number;
  loadFactor: number | null;
  revenue: number;
  variableCosts: number;
  contribution: number;
  fixedCosts: number;
  operatingResult: number;
}

export function routePnl(a: RouteAssumptions = BASE_ASSUMPTIONS) {
  const fuelPerBh = FUEL_BURN_T_PER_BH * a.fuelPrice;
  const k = 1 + a.otherCostChange;
  const months: MonthPnl[] = airlineData.forecast.map((f, i) => {
    const freq = a.winterFrequency !== null && WINTER.has(i) ? a.winterFrequency : f.weekly_round_trips;
    const sectors = a.winterFrequency !== null && WINTER.has(i) ? Math.round(freq * 2 * WEEKS_PER_MONTH[i]) : f.sectors;
    const operating = sectors > 0;
    const seats = sectors * f.seats_per_sector;
    const demand = f.demand_base * (1 + a.demandChange);
    const passengers = Math.min(demand, seats * MAX_LOAD_FACTOR);
    const fare = f.avg_fare_base * (1 + a.fareChange);
    const revenue = passengers * fare;
    const perSector = BLOCK_HOURS_PER_SECTOR * (fuelPerBh + (UNIT_COSTS.crewPerBlockHour + UNIT_COSTS.maintenancePerBlockHour) * k + UNIT_COSTS.aircraftOwnershipPerBlockHour) + UNIT_COSTS.airportAtcPerDeparture * k;
    const perPax = UNIT_COSTS.passengerFees * k + UNIT_COSTS.distributionHandlingPerPax;
    const variableCosts = sectors * perSector + passengers * perPax;
    const fixedCosts = operating
      ? FIXED.routeOverheadMonthly + FIXED.stationMonthly + FIXED.insuranceMonthly
      : FIXED.stationSuspendedMonthly + FIXED.insuranceMonthly;
    return {
      month: f.month, operating, sectors, seats, demand, passengers,
      loadFactor: safeDivide(passengers, seats),
      revenue, variableCosts, contribution: revenue - variableCosts, fixedCosts,
      operatingResult: revenue - variableCosts - fixedCosts,
    };
  });
  const sum = (k2: keyof MonthPnl) => months.reduce((acc, m) => acc + (m[k2] as number), 0);
  const oneOffs = a.includeOneOffs ? FIXED.launchMarketingOneOff + FIXED.routeSetupOneOff : 0;
  const revenue = sum("revenue");
  const variableCosts = sum("variableCosts");
  const fixedCosts = sum("fixedCosts") + oneOffs;
  const passengers = sum("passengers");
  const seats = sum("seats");
  const sectors = sum("sectors");
  const avgFare = safeDivide(revenue, passengers);
  const perPax = UNIT_COSTS.passengerFees * k + UNIT_COSTS.distributionHandlingPerPax;
  const sectorCosts = variableCosts - passengers * perPax;
  // Break-even LF: seats × LF × (fare − per-pax cost) = sector costs + fixed costs
  const breakEvenLf = avgFare === null ? null : safeDivide(sectorCosts + fixedCosts, seats * (avgFare - perPax));
  return {
    months,
    revenue,
    variableCosts,
    contribution: revenue - variableCosts,
    fixedCosts,
    oneOffs,
    operatingResult: revenue - variableCosts - fixedCosts,
    passengers,
    seats,
    sectors,
    loadFactor: safeDivide(passengers, seats),
    avgFare,
    breakEvenLf,
    margin: safeDivide(revenue - variableCosts - fixedCosts, revenue),
  };
}
