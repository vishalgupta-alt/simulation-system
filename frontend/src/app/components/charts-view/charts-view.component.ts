import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SimulationService } from '../../services/simulation.service';
import { ApiService, Plan, Waypoint, MapMetadata } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface WaypointFuelDetail {
  name: string;
  fuelRemaining: number;
  timeOffsetMinutes: number;
  latitude?: number;
  longitude?: number;
}

@Component({
  selector: 'app-charts-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './charts-view.component.html',
  styles: [`
    .charts-dashboard {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      padding: 16px;
      height: 100%;
      overflow-y: auto;
    }
    @media (min-width: 1024px) {
      .charts-dashboard {
        grid-template-columns: 1.2fr 0.8fr; /* Left for charts, right for waypoint flow */
      }
    }
    .chart-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      height: 340px;
      margin-bottom: 20px;
    }
    .chart-wrapper {
      position: relative;
      flex: 1;
      width: 100%;
      height: 100%;
    }
    .details-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      height: 700px;
    }
    /* Flow node connector styles */
    .flow-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .flow-node-row {
      display: flex;
      align-items: center;
      position: relative;
    }
    .flow-node-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      border: 2px solid var(--color-cyan);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 11px;
      color: #ffffff;
      box-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
      z-index: 2;
    }
    .flow-node-line {
      width: 4px;
      height: 30px;
      background: var(--border-color);
      margin-left: 22px;
      z-index: 1;
    }
    .flow-node-info {
      margin-left: 16px;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class ChartsViewComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('fuelChartCanvas') fuelChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('distanceChartCanvas') distanceChartCanvas!: ElementRef<HTMLCanvasElement>;

  private fuelChart: Chart | null = null;
  private distanceChart: Chart | null = null;
  
  plansList: Plan[] = [];
  selectedPlan: Plan | null = null;
  selectedPlanWaypointsFuel: WaypointFuelDetail[] = [];
  mapMetadata: MapMetadata | null = null;

  simulationDuration: number = 24 * 3600;

  constructor(
    private simulationService: SimulationService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.loadMapMetadata();
    this.loadPlans();
    this.simulationService.simulationDuration$.subscribe(duration => {
      this.simulationDuration = duration;
      this.updateCharts();
    });
  }

  loadMapMetadata() {
    this.apiService.getMapMetadata().subscribe({
      next: (meta) => {
        this.mapMetadata = meta;
        this.calculateWaypointFuelDetails();
      },
      error: (err) => {
        console.error('Failed to load map metadata in charts-view', err);
      }
    });
  }

  loadPlans() {
    this.apiService.getPlans().subscribe(plans => {
      this.plansList = plans;
      if (plans.length > 0) {
        this.selectedPlan = plans[0];
        this.calculateWaypointFuelDetails();
      }
      this.updateCharts();
    });
  }

  ngAfterViewInit() {
    this.initCharts();
    this.updateCharts();
  }

  ngOnDestroy() {
    if (this.fuelChart) this.fuelChart.destroy();
    if (this.distanceChart) this.distanceChart.destroy();
  }

  onPlanSelectChange() {
    this.calculateWaypointFuelDetails();
  }

  calculateWaypointFuelDetails() {
    if (!this.selectedPlan) return;
    
    const plan = this.selectedPlan;
    const wps = plan.waypoints || [];
    if (wps.length === 0) {
      this.selectedPlanWaypointsFuel = [];
      return;
    }

    const details: WaypointFuelDetail[] = [];
    const fuelLimit = plan.fuelLimit || 1000.0;
    const fuelConsumption = plan.fuelConsumption || 1.0;
    const fuelConsumptionPerSec = fuelConsumption / 60.0;
    
    let cumulativeDist = 0;
    
    const getLon = (wp: Waypoint) => {
      if (wp.longitude !== undefined && wp.longitude !== null) return wp.longitude;
      return -180.0 + (wp.x / 1000) * 360.0;
    };

    const getLat = (wp: Waypoint) => {
      if (wp.latitude !== undefined && wp.latitude !== null) return wp.latitude;
      return 90.0 - (wp.y / 1000) * 180.0;
    };

    details.push({
      name: wps[0].name || 'WP 1',
      fuelRemaining: fuelLimit,
      timeOffsetMinutes: 0,
      latitude: getLat(wps[0]),
      longitude: getLon(wps[0])
    });

    for (let i = 1; i < wps.length; i++) {
      const p1 = wps[i - 1];
      const p2 = wps[i];
      const dLon = getLon(p2) - getLon(p1);
      const dLat = getLat(p2) - getLat(p1);
      const dist = Math.sqrt(dLon * dLon + dLat * dLat);
      cumulativeDist += dist;

      const speedInDegSec = plan.speed / 216000.0;
      const timeToReachSeconds = speedInDegSec > 0 ? cumulativeDist / speedInDegSec : 0;
      const fuelUsed = timeToReachSeconds * fuelConsumptionPerSec;
      const fuelRemaining = Math.max(0, fuelLimit - fuelUsed);

      details.push({
        name: p2.name || `WP ${i + 1}`,
        fuelRemaining: Math.round(fuelRemaining * 10) / 10,
        timeOffsetMinutes: Math.round((timeToReachSeconds / 60) * 10) / 10,
        latitude: getLat(p2),
        longitude: getLon(p2)
      });
    }

    this.selectedPlanWaypointsFuel = details;
  }

  formatGeoCoords(lat?: number, lon?: number): string {
    if (lat === undefined || lon === undefined || lat === null || lon === null) return '';
    const latDirection = lat >= 0 ? 'N' : 'S';
    const lonDirection = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDirection}, ${Math.abs(lon).toFixed(4)}° ${lonDirection}`;
  }

  private initCharts() {
    const ctxFuel = this.fuelChartCanvas.nativeElement.getContext('2d');
    if (ctxFuel) {
      this.fuelChart = new Chart(ctxFuel, {
        type: 'line',
        data: {
          labels: [],
          datasets: []
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#f8fafc', font: { family: 'Outfit' } }
            },
            title: {
              display: true,
              text: 'Fuel Level deprecation over Simulation Timeline (Lit)',
              color: '#f8fafc',
              font: { size: 13, family: 'Outfit', weight: 'bold' }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.03)' },
              ticks: { color: '#94a3b8' }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.03)' },
              ticks: { color: '#94a3b8' },
              min: 0
            }
          }
        }
      });
    }

    const ctxDist = this.distanceChartCanvas.nativeElement.getContext('2d');
    if (ctxDist) {
      this.distanceChart = new Chart(ctxDist, {
        type: 'bar',
        data: {
          labels: [],
          datasets: []
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'Plan Comparisons: Total Distance Covered (NM)',
              color: '#f8fafc',
              font: { size: 13, family: 'Outfit', weight: 'bold' }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.03)' },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    }
  }

  private updateCharts() {
    if (!this.fuelChart || !this.distanceChart || this.plansList.length === 0) return;

    const duration = this.simulationDuration;
    const intervals = 10;
    const step = duration / intervals;
    const labels: string[] = [];
    const timePoints: number[] = [];

    for (let i = 0; i <= intervals; i++) {
      const sec = Math.round(i * step);
      timePoints.push(sec);
      
      if (duration < 3600) {
        labels.push(`${Math.round(sec / 60)}m`);
      } else {
        const hrs = Math.round((sec / 3600) * 10) / 10;
        labels.push(`${hrs}h`);
      }
    }

    const fuelDatasets = this.plansList.map((plan, idx) => {
      const colors = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#06b6d4', '#ec4899'];
      const color = colors[idx % colors.length];

      const data = timePoints.map(simSeconds => {
        const planStart = new Date(plan.startTime);
        const gameStart = this.simulationService.getGameStartDate();
        const planStartOffset = (planStart.getTime() - gameStart.getTime()) / 1000;

        if (simSeconds < planStartOffset) {
          return 1000.0;
        }

        const timeMoving = simSeconds - planStartOffset;
        
        let totalPathLength = 0;
        const waypoints = plan.waypoints || [];
        
        const getLon = (wp: Waypoint) => {
          if (wp.longitude !== undefined && wp.longitude !== null) return wp.longitude;
          return -180.0 + (wp.x / 1000) * 360.0;
        };

        const getLat = (wp: Waypoint) => {
          if (wp.latitude !== undefined && wp.latitude !== null) return wp.latitude;
          return 90.0 - (wp.y / 1000) * 180.0;
        };

        for (let i = 0; i < waypoints.length - 1; i++) {
          const p1 = waypoints[i];
          const p2 = waypoints[i + 1];
          const dLon = getLon(p2) - getLon(p1);
          const dLat = getLat(p2) - getLat(p1);
          totalPathLength += Math.sqrt(dLon * dLon + dLat * dLat);
        }

        const speedInDegSec = plan.speed / 216000.0;
        const timeToDestination = speedInDegSec > 0 ? totalPathLength / speedInDegSec : 0;
        const fuelLimit = plan.fuelLimit || 1000.0;
        const fuelConsumption = plan.fuelConsumption || 1.0;
        const fuelConsumptionPerSec = fuelConsumption / 60.0;
        
        if (timeMoving >= timeToDestination) {
          const fuelUsed = timeToDestination * fuelConsumptionPerSec;
          return Math.max(0, fuelLimit - fuelUsed);
        }

        const fuelUsed = timeMoving * fuelConsumptionPerSec;
        return Math.max(0, fuelLimit - fuelUsed);
      });

      return {
        label: plan.name,
        data: data,
        borderColor: color,
        backgroundColor: color + '15',
        tension: 0.15,
        fill: false
      };
    });

    this.fuelChart.data.labels = labels;
    this.fuelChart.data.datasets = fuelDatasets;
    this.fuelChart.update();

    const distanceData = this.plansList.map(plan => {
      let totalPathLength = 0;
      const waypoints = plan.waypoints || [];
      
      const getLon = (wp: Waypoint) => {
        if (wp.longitude !== undefined && wp.longitude !== null) return wp.longitude;
        return -180.0 + (wp.x / 1000) * 360.0;
      };

      const getLat = (wp: Waypoint) => {
        if (wp.latitude !== undefined && wp.latitude !== null) return wp.latitude;
        return 90.0 - (wp.y / 1000) * 180.0;
      };

      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        const dLon = getLon(p2) - getLon(p1);
        const dLat = getLat(p2) - getLat(p1);
        totalPathLength += Math.sqrt(dLon * dLon + dLat * dLat);
      }
      return Math.round(totalPathLength * 60);
    });

    const colors = this.plansList.map((_, idx) => {
      const bgColors = ['#3b82f6aa', '#f59e0baa', '#10b981aa', '#a855f7aa', '#06b6d4aa', '#ec4899aa'];
      return bgColors[idx % bgColors.length];
    });

    this.distanceChart.data.labels = this.plansList.map(p => p.name);
    this.distanceChart.data.datasets = [{
      label: 'Approx. Distance (NM)',
      data: distanceData,
      backgroundColor: colors,
      borderColor: colors.map(c => c.replace('aa', '')),
      borderWidth: 1.5
    }];
    this.distanceChart.update();
  }
}
