import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewComponent } from './components/map-view/map-view.component';
import { SimulationService } from './services/simulation.service';
import { ApiService } from './services/api.service';
import { 
  LucideRoute, 
  LucideCircle, 
  LucideAreaChart,
  LucidePlay,
  LucidePause,
  LucideRotateCcw,
  LucideSkipBack,
  LucideSkipForward
} from '@lucide/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapViewComponent,
    LucideRoute,
    LucideCircle,
    LucideAreaChart,
    LucidePlay,
    LucidePause,
    LucideRotateCcw,
    LucideSkipBack,
    LucideSkipForward
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App implements OnInit, OnDestroy {
  title = 'Tactical Simulation Command Center';
  activeTab: 'plan' | 'deploy' | 'charts' = 'deploy';
  systemTime: Date = new Date();
  private systemTimeInterval: any;

  constructor(
    public simulationService: SimulationService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.loadData();
    this.systemTimeInterval = setInterval(() => {
      this.systemTime = new Date();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.systemTimeInterval) {
      clearInterval(this.systemTimeInterval);
    }
  }

  loadData() {
    this.apiService.getPlans().subscribe(plans => {
      this.simulationService.setPlans(plans);
    });

    this.apiService.getEllipses().subscribe(ellipses => {
      this.simulationService.setEllipses(ellipses);
    });
  }

  switchTab(tab: 'plan' | 'deploy' | 'charts') {
    this.activeTab = tab;
  }

  getLocalISOString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  }

  onGameStartDateChange(eventVal: string) {
    if (eventVal) {
      this.simulationService.setGameStartDate(new Date(eventVal));
    }
  }

  onSliderChange(event: any) {
    const val = Number(event.target.value);
    this.simulationService.setCurrentTimeOffset(val);
  }

  getFormattedSimTime(): string {
    return this.simulationService.getCurrentTime().toLocaleTimeString();
  }

  getFormattedSimDate(): string {
    return this.simulationService.getCurrentTime().toLocaleDateString();
  }

  getFormattedSystemTime(): string {
    return this.systemTime.toLocaleString();
  }

  getFormattedSimDateTime(): string {
    const time = this.simulationService.getCurrentTime();
    return time.toLocaleDateString() + ' ' + time.toLocaleTimeString();
  }
}
