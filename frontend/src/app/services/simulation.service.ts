import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Plan, EllipseZone, Waypoint } from './api.service';

export interface SymbolState {
  planId: string;
  planName: string;
  currentX: number;
  currentY: number;
  fuelRemaining: number;
  distanceTraveled: number;
  isStarted: boolean;
  isFinished: boolean;
  isOutofFuel: boolean;
  activeSegmentIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  // Config parameters
  private gameStartSubject = new BehaviorSubject<Date>(new Date(2026, 5, 10, 8, 0, 0)); // default start
  public gameStart$ = this.gameStartSubject.asObservable();

  private simulationDurationSubject = new BehaviorSubject<number>(24 * 3600); // dynamic duration in seconds
  public simulationDuration$ = this.simulationDurationSubject.asObservable();

  private currentTimeOffsetSubject = new BehaviorSubject<number>(0); // offset in seconds from start
  public currentTimeOffset$ = this.currentTimeOffsetSubject.asObservable();

  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  public isPlaying$ = this.isPlayingSubject.asObservable();

  private isTimeBasedSubject = new BehaviorSubject<boolean>(true); // true = time-based, false = event-based
  public isTimeBased$ = this.isTimeBasedSubject.asObservable();

  private timeStepIntervalSubject = new BehaviorSubject<number>(60); // 1 = 1 sec, 60 = 1 min
  public timeStepInterval$ = this.timeStepIntervalSubject.asObservable();

  private playbackSpeedSubject = new BehaviorSubject<number>(10); // multiplier, e.g. 10x, 60x, 600x
  public playbackSpeed$ = this.playbackSpeedSubject.asObservable();

  // Data streams loaded from backend
  private plansSubject = new BehaviorSubject<Plan[]>([]);
  public plans$ = this.plansSubject.asObservable();

  private ellipsesSubject = new BehaviorSubject<EllipseZone[]>([]);
  public ellipses$ = this.ellipsesSubject.asObservable();

  // Calculated symbols states
  private symbolStatesSubject = new BehaviorSubject<SymbolState[]>([]);
  public symbolStates$ = this.symbolStatesSubject.asObservable();

  private timerId: any = null;
  private lastTickTime: number = 0;

  constructor() {
    this.gameStart$.subscribe(() => this.recalculateSymbolStates());
    this.currentTimeOffset$.subscribe(() => this.recalculateSymbolStates());
    this.plans$.subscribe(() => this.recalculateSymbolStates());
  }

  // --- Controls ---

  setGameStartDate(date: Date) {
    this.gameStartSubject.next(date);
  }

  getGameStartDate(): Date {
    return this.gameStartSubject.value;
  }

  setPlans(plans: Plan[]) {
    this.plansSubject.next(plans);
    this.updateTimelineBounds();
    this.recalculateSymbolStates();
  }

  private updateTimelineBounds() {
    const plans = this.plansSubject.value;
    if (!plans || plans.length === 0) {
      // Default to 24 hours if no plans exist
      this.simulationDurationSubject.next(24 * 3600);
      return;
    }

    let minStartMs = Infinity;
    let maxEndMs = -Infinity;

    plans.forEach(plan => {
      const planStart = new Date(plan.startTime);
      const startMs = planStart.getTime();
      
      if (startMs < minStartMs) {
        minStartMs = startMs;
      }

      // Calculate path length to estimate travel time
      let totalPathLength = 0;
      const wps = plan.waypoints || [];
      for (let i = 0; i < wps.length - 1; i++) {
        const p1 = wps[i];
        const p2 = wps[i + 1];
        totalPathLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      }

      const speedInPxSec = plan.speed * 10;
      const travelTimeSeconds = speedInPxSec > 0 ? totalPathLength / speedInPxSec : 0;
      
      // Fuel limit is 1000 Lit, depletion at 1 Lit/minute = 1/60 Lit/sec
      // So fuel depletion occurs at 1000 * 60 = 60,000 seconds maximum moving time
      const maxMovingTimeSeconds = Math.min(travelTimeSeconds, 60000);
      const endMs = startMs + maxMovingTimeSeconds * 1000;

      if (endMs > maxEndMs) {
        maxEndMs = endMs;
      }
    });

    if (minStartMs !== Infinity && maxEndMs !== -Infinity) {
      // Set the simulation start date to the earliest plan's start time
      const gameStart = new Date(minStartMs);
      this.gameStartSubject.next(gameStart);

      // Set duration in seconds
      const durationSeconds = Math.max(60, Math.ceil((maxEndMs - minStartMs) / 1000));
      this.simulationDurationSubject.next(durationSeconds);
      
      // If current offset is now out of bounds, reset it
      if (this.currentTimeOffsetSubject.value > durationSeconds) {
        this.currentTimeOffsetSubject.next(0);
      }
    }
  }

  setEllipses(ellipses: EllipseZone[]) {
    this.ellipsesSubject.next(ellipses);
  }

  setCurrentTimeOffset(offset: number) {
    const maxDuration = this.simulationDurationSubject.value;
    let reachedEnd = false;
    if (offset < 0) offset = 0;
    if (offset >= maxDuration) {
      offset = maxDuration;
      reachedEnd = true;
    }
    this.currentTimeOffsetSubject.next(offset);
    if (reachedEnd && this.isPlayingSubject.value) {
      this.setPlaying(false);
    }
  }

  getCurrentTimeOffset(): number {
    return this.currentTimeOffsetSubject.value;
  }

  getCurrentTime(): Date {
    return new Date(this.getGameStartDate().getTime() + this.getCurrentTimeOffset() * 1000);
  }

  setPlaying(isPlaying: boolean) {
    this.isPlayingSubject.next(isPlaying);
    if (isPlaying) {
      this.lastTickTime = Date.now();
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }

  setTimeBased(isTimeBased: boolean) {
    this.isTimeBasedSubject.next(isTimeBased);
  }

  setTimeStepInterval(seconds: number) {
    this.timeStepIntervalSubject.next(seconds);
  }

  setPlaybackSpeed(speed: number) {
    this.playbackSpeedSubject.next(speed);
  }

  getPlaybackSpeed(): number {
    return this.playbackSpeedSubject.value;
  }

  resetSimulation() {
    this.setPlaying(false);
    this.setCurrentTimeOffset(0);
  }

  // --- Step Forward / Backward ---
  stepForward() {
    if (this.isTimeBasedSubject.value) {
      const step = this.timeStepIntervalSubject.value; // 1s or 60s
      this.setCurrentTimeOffset(this.getCurrentTimeOffset() + step);
    } else {
      // Event-based step forward
      const nextEventOffset = this.getNextEventOffset();
      if (nextEventOffset !== null) {
        this.setCurrentTimeOffset(nextEventOffset);
      }
    }
  }

  stepBackward() {
    if (this.isTimeBasedSubject.value) {
      const step = this.timeStepIntervalSubject.value; // 1s or 60s
      this.setCurrentTimeOffset(this.getCurrentTimeOffset() - step);
    } else {
      // Event-based step backward
      const prevEventOffset = this.getPreviousEventOffset();
      if (prevEventOffset !== null) {
        this.setCurrentTimeOffset(prevEventOffset);
      }
    }
  }

  // --- Simulation Engine Loop ---

  private startTimer() {
    this.stopTimer();
    this.timerId = setInterval(() => {
      if (!this.isPlayingSubject.value) {
        this.stopTimer();
        return;
      }
      
      const now = Date.now();
      const elapsedRealMs = now - this.lastTickTime;
      this.lastTickTime = now;

      if (this.isTimeBasedSubject.value) {
        // Continuous time progression scaled by speed multiplier
        const elapsedSimSeconds = (elapsedRealMs / 1000) * this.playbackSpeedSubject.value;
        this.setCurrentTimeOffset(this.getCurrentTimeOffset() + elapsedSimSeconds);
      } else {
        // In event-based mode, standard playback auto-advances to the next event every 1.5 seconds of real-time
        if (elapsedRealMs >= 1500) {
          this.stepForward();
          this.lastTickTime = now;
        }
      }
    }, 100);
  }

  private stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  // --- Event Calculations ---

  // Gather all events and their offsets
  public getAllEventOffsets(): number[] {
    const plans = this.plansSubject.value;
    const gameStart = this.getGameStartDate();
    const offsetsSet = new Set<number>();
    
    // Add start offset 0
    offsetsSet.add(0);

    plans.forEach(plan => {
      const planStart = new Date(plan.startTime);
      const startOffset = Math.max(0, Math.floor((planStart.getTime() - gameStart.getTime()) / 1000));
      offsetsSet.add(startOffset);

      // We need waypoint reach times and out-of-fuel times
      if (plan.waypoints && plan.waypoints.length > 0) {
        // Calculate cumulative lengths of segments
        let cumulativeDist = 0;
        let lastPt = plan.waypoints[0];
        const reachOffsets: number[] = [startOffset];

        for (let i = 1; i < plan.waypoints.length; i++) {
          const pt = plan.waypoints[i];
          const dx = pt.x - lastPt.x;
          const dy = pt.y - lastPt.y;
          const segDist = Math.sqrt(dx * dx + dy * dy);
          cumulativeDist += segDist;
          lastPt = pt;

          // Speed in pixels/sec (we scale this in UI, say 1 speed = 10 pixels/sec)
          const speedInPxSec = plan.speed * 10;
          const timeToReachSeg = speedInPxSec > 0 ? cumulativeDist / speedInPxSec : 0;
          const reachOffset = Math.floor(startOffset + timeToReachSeg);
          reachOffsets.push(reachOffset);
          offsetsSet.add(reachOffset);
        }

        // Fuel limit limit 1000 Lit, 1 Lit/minute = 1/60 Lit/sec
        // Fuel depletion time = 1000 * 60 = 60,000 seconds of active movement
        const fuelConsumptionPerSec = 1.0 / 60.0;
        const outOfFuelOffset = Math.floor(startOffset + (1000.0 / fuelConsumptionPerSec));
        if (outOfFuelOffset < this.simulationDurationSubject.value) {
          // Check if it runs out of fuel before finishing the path
          const speedInPxSec = plan.speed * 10;
          const totalPathTime = speedInPxSec > 0 ? cumulativeDist / speedInPxSec : 0;
          if (1000.0 / fuelConsumptionPerSec < totalPathTime) {
            offsetsSet.add(outOfFuelOffset);
          }
        }
      }
    });

    return Array.from(offsetsSet).sort((a, b) => a - b);
  }

  private getNextEventOffset(): number | null {
    const offsets = this.getAllEventOffsets();
    const current = this.getCurrentTimeOffset();
    for (const offset of offsets) {
      if (offset > current + 1) {
        return offset;
      }
    }
    return null;
  }

  private getPreviousEventOffset(): number | null {
    const offsets = this.getAllEventOffsets();
    const current = this.getCurrentTimeOffset();
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (offsets[i] < current - 1) {
        return offsets[i];
      }
    }
    return 0;
  }

  // --- Mathematics of Motion & Fuel ---

  public recalculateSymbolStates() {
    const plans = this.plansSubject.value;
    const gameStart = this.getGameStartDate();
    const currentOffset = this.getCurrentTimeOffset();

    const states: SymbolState[] = plans.map(plan => {
      const planStart = new Date(plan.startTime);
      const startOffset = (planStart.getTime() - gameStart.getTime()) / 1000;
      
      const waypoints = plan.waypoints || [];
      
      // Default state at start position
      const defaultState: SymbolState = {
        planId: plan.id || '',
        planName: plan.name,
        currentX: waypoints.length > 0 ? waypoints[0].x : 0,
        currentY: waypoints.length > 0 ? waypoints[0].y : 0,
        fuelRemaining: 1000.0,
        distanceTraveled: 0,
        isStarted: false,
        isFinished: false,
        isOutofFuel: false,
        activeSegmentIndex: -1
      };

      if (waypoints.length === 0) return defaultState;

      // Has simulation reached start time?
      if (currentOffset < startOffset) {
        return defaultState;
      }

      // Compute total segments lengths
      const segmentLengths: number[] = [];
      let totalPathLength = 0;
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        segmentLengths.push(dist);
        totalPathLength += dist;
      }

      // Convert speed factor to pixels/second
      const speedInPxSec = plan.speed * 10;
      if (speedInPxSec <= 0) {
        return {
          ...defaultState,
          isStarted: true
        };
      }

      const timeMoving = currentOffset - startOffset; // seconds since start of this plan

      // Fuel logic: 1 Lit/minute = 1/60 Lit/sec
      const fuelConsumptionPerSec = 1.0 / 60.0;
      const totalFuelCapacity = 1000.0;
      
      // Calculate how long fuel lasts in seconds: 1000 / (1/60) = 60,000 seconds (16.66 hours)
      const maxMovingTimeWithFuel = totalFuelCapacity / fuelConsumptionPerSec; // 60,000s

      let actualMovingTime = timeMoving;
      let isOutofFuel = false;
      let fuelRemaining = totalFuelCapacity - (timeMoving * fuelConsumptionPerSec);

      if (fuelRemaining <= 0) {
        fuelRemaining = 0;
        actualMovingTime = maxMovingTimeWithFuel;
        isOutofFuel = true;
      }

      // Check if it reached destination
      const maxDistance = totalPathLength;
      const theoreticalDistance = actualMovingTime * speedInPxSec;
      
      let distanceTraveled = theoreticalDistance;
      let isFinished = false;

      if (theoreticalDistance >= maxDistance) {
        distanceTraveled = maxDistance;
        isFinished = true;
        isOutofFuel = false; // Stopped at destination, didn't run out of fuel during transit if it reached before depletion
        // Recalculate actual fuel spent to reach destination
        const timeToDestination = maxDistance / speedInPxSec;
        fuelRemaining = Math.max(0, totalFuelCapacity - (timeToDestination * fuelConsumptionPerSec));
      }

      // Find current position based on distanceTraveled
      let currentX = waypoints[0].x;
      let currentY = waypoints[0].y;
      let accumulatedDistance = 0;
      let activeSegmentIndex = -1;

      if (isFinished) {
        currentX = waypoints[waypoints.length - 1].x;
        currentY = waypoints[waypoints.length - 1].y;
        activeSegmentIndex = waypoints.length - 2;
      } else {
        for (let i = 0; i < segmentLengths.length; i++) {
          const segLen = segmentLengths[i];
          if (distanceTraveled <= accumulatedDistance + segLen) {
            // Interpolate on this segment
            const ratio = (distanceTraveled - accumulatedDistance) / segLen;
            const p1 = waypoints[i];
            const p2 = waypoints[i + 1];
            currentX = p1.x + (p2.x - p1.x) * ratio;
            currentY = p1.y + (p2.y - p1.y) * ratio;
            activeSegmentIndex = i;
            break;
          }
          accumulatedDistance += segLen;
        }
      }

      return {
        planId: plan.id || '',
        planName: plan.name,
        currentX,
        currentY,
        fuelRemaining: Math.round(fuelRemaining * 100) / 100,
        distanceTraveled: Math.round(distanceTraveled * 100) / 100,
        isStarted: true,
        isFinished,
        isOutofFuel,
        activeSegmentIndex
      };
    });

    this.symbolStatesSubject.next(states);
  }
}
