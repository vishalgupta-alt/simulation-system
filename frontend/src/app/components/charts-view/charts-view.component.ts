import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SimulationService } from '../../services/simulation.service';
import { ApiService, Plan, Waypoint } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface WaypointFuelDetail {
  name: string;
  fuelRemaining: number;
  timeOffsetMinutes: number;
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

  constructor(
    private simulationService: SimulationService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.loadPlans();
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
    const speedInPxSec = plan.speed * 10;
    const fuelConsumptionPerSec = 1.0 / 60.0;
    
    let cumulativeDist = 0;
    
    // Add start waypoint details
    details.push({
      name: wps[0].name || 'WP 1',
      fuelRemaining: 1000.0,
      timeOffsetMinutes: 0
    });

    for (let i = 1; i < wps.length; i++) {
      const p1 = wps[i - 1];
      const p2 = wps[i];
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      cumulativeDist += dist;

      const timeToReachSeconds = speedInPxSec > 0 ? cumulativeDist / speedInPxSec : 0;
      const fuelUsed = timeToReachSeconds * fuelConsumptionPerSec;
      const fuelRemaining = Math.max(0, 1000.0 - fuelUsed);

      details.push({
        name: p2.name || `WP ${i + 1}`,
        fuelRemaining: Math.round(fuelRemaining * 10) / 10,
        timeOffsetMinutes: Math.round((timeToReachSeconds / 60) * 10) / 10
      });
    }

    this.selectedPlanWaypointsFuel = details;
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
              min: 0,
              max: 1000
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
              text: 'Plan Comparisons: Total Distance Covered (Pixels)',
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

    // 1. Generate Fuel Over Time Data (sample 12 points along the 24 hours simulation)
    const hours = Array.from({ length: 13 }, (_, i) => i * 2);
    const labels = hours.map(h => `${h}h`);

    const fuelDatasets = this.plansList.map((plan, idx) => {
      const colors = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#06b6d4', '#ec4899'];
      const color = colors[idx % colors.length];

      const data = hours.map(h => {
        const simSeconds = h * 3600;
        const planStart = new Date(plan.startTime);
        const gameStart = this.simulationService.getGameStartDate();
        const planStartOffset = (planStart.getTime() - gameStart.getTime()) / 1000;

        if (simSeconds < planStartOffset) {
          return 1000.0;
        }

        const timeMoving = simSeconds - planStartOffset;
        
        let totalPathLength = 0;
        const waypoints = plan.waypoints || [];
        for (let i = 0; i < waypoints.length - 1; i++) {
          const p1 = waypoints[i];
          const p2 = waypoints[i + 1];
          totalPathLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }

        const speedInPxSec = plan.speed * 10;
        const timeToDestination = speedInPxSec > 0 ? totalPathLength / speedInPxSec : 0;

        const fuelConsumptionPerSec = 1.0 / 60.0;
        
        if (timeMoving >= timeToDestination) {
          const fuelUsed = timeToDestination * fuelConsumptionPerSec;
          return Math.max(0, 1000.0 - fuelUsed);
        }

        const fuelUsed = timeMoving * fuelConsumptionPerSec;
        return Math.max(0, 1000.0 - fuelUsed);
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

    // 2. Generate Distance Covered Data
    const distanceData = this.plansList.map(plan => {
      let totalPathLength = 0;
      const waypoints = plan.waypoints || [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        totalPathLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      }
      return Math.round(totalPathLength);
    });

    const colors = this.plansList.map((_, idx) => {
      const bgColors = ['#3b82f6aa', '#f59e0baa', '#10b981aa', '#a855f7aa', '#06b6d4aa', '#ec4899aa'];
      return bgColors[idx % bgColors.length];
    });

    this.distanceChart.data.labels = this.plansList.map(p => p.name);
    this.distanceChart.data.datasets = [{
      label: 'Distance',
      data: distanceData,
      backgroundColor: colors,
      borderColor: colors.map(c => c.replace('aa', '')),
      borderWidth: 1.5
    }];
    this.distanceChart.update();
  }
}
