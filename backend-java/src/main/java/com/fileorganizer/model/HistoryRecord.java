package com.fileorganizer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "history")
public class HistoryRecord {

    @Id
    @Column(name = "id")
    @JsonProperty("_id")
    private String id;

    @Column(unique = true, nullable = false, length = 2000)
    private String folderPath;

    @Temporal(TemporalType.TIMESTAMP)
    private Date lastOrganizedAt;

    private boolean isAutoOrganizing;

    public HistoryRecord() {
    }

    public HistoryRecord(String folderPath, Date lastOrganizedAt, boolean isAutoOrganizing) {
        this.id = UUID.randomUUID().toString();
        this.folderPath = folderPath;
        this.lastOrganizedAt = lastOrganizedAt;
        this.isAutoOrganizing = isAutoOrganizing;
    }

    @PrePersist
    protected void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        if (this.lastOrganizedAt == null) {
            this.lastOrganizedAt = new Date();
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFolderPath() {
        return folderPath;
    }

    public void setFolderPath(String folderPath) {
        this.folderPath = folderPath;
    }

    public Date getLastOrganizedAt() {
        return lastOrganizedAt;
    }

    public void setLastOrganizedAt(Date lastOrganizedAt) {
        this.lastOrganizedAt = lastOrganizedAt;
    }

    @JsonProperty("isAutoOrganizing")
    public boolean isAutoOrganizing() {
        return isAutoOrganizing;
    }

    public void setAutoOrganizing(boolean isAutoOrganizing) {
        this.isAutoOrganizing = isAutoOrganizing;
    }
}
