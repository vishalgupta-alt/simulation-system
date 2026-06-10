package com.drdo.simulation.model;

import jakarta.persistence.Embeddable;

@Embeddable
public class Waypoint {
    private double x;
    private double y;
    private String name;

    public Waypoint() {}

    public Waypoint(double x, double y, String name) {
        this.x = x;
        this.y = y;
        this.name = name;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
