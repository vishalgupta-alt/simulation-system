package com.drdo.simulation.model;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "plans")
public class Plan {
    @Id
    private String id;
    private String name;
    private double speed;
    private String startTime;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "plan_waypoints", joinColumns = @JoinColumn(name = "plan_id"))
    private List<Waypoint> waypoints;

    private double fuelLimit = 1000.0;
    private double fuelConsumption = 1.0;

    public Plan() {}

    public Plan(String id, String name, double speed, String startTime, List<Waypoint> waypoints, double fuelLimit, double fuelConsumption) {
        this.id = id;
        this.name = name;
        this.speed = speed;
        this.startTime = startTime;
        this.waypoints = waypoints;
        this.fuelLimit = fuelLimit;
        this.fuelConsumption = fuelConsumption;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getSpeed() {
        return speed;
    }

    public void setSpeed(double speed) {
        this.speed = speed;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public List<Waypoint> getWaypoints() {
        return waypoints;
    }

    public void setWaypoints(List<Waypoint> waypoints) {
        this.waypoints = waypoints;
    }

    public double getFuelLimit() {
        return fuelLimit;
    }

    public void setFuelLimit(double fuelLimit) {
        this.fuelLimit = fuelLimit;
    }

    public double getFuelConsumption() {
        return fuelConsumption;
    }

    public void setFuelConsumption(double fuelConsumption) {
        this.fuelConsumption = fuelConsumption;
    }
}
