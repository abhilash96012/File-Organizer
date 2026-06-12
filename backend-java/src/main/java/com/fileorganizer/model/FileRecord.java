package com.fileorganizer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "files")
public class FileRecord {

    @Id
    @Column(name = "id")
    @JsonProperty("_id")
    private String id;

    private String filename;
    private String originalName;
    private String category;

    @Column(length = 2000)
    private String filePath;

    private Long size;

    @Temporal(TemporalType.TIMESTAMP)
    private Date uploadDate;

    private String hash;

    @Column(length = 2000)
    private String duplicateOf;

    public FileRecord() {
    }

    public FileRecord(String filename, String originalName, String category, String filePath, Long size, String hash, String duplicateOf) {
        this.id = UUID.randomUUID().toString();
        this.filename = filename;
        this.originalName = originalName;
        this.category = category;
        this.filePath = filePath;
        this.size = size;
        this.uploadDate = new Date();
        this.hash = hash != null ? hash : "";
        this.duplicateOf = duplicateOf;
    }

    @PrePersist
    protected void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        if (this.uploadDate == null) {
            this.uploadDate = new Date();
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getOriginalName() {
        return originalName;
    }

    public void setOriginalName(String originalName) {
        this.originalName = originalName;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public Long getSize() {
        return size;
    }

    public void setSize(Long size) {
        this.size = size;
    }

    public Date getUploadDate() {
        return uploadDate;
    }

    public void setUploadDate(Date uploadDate) {
        this.uploadDate = uploadDate;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getDuplicateOf() {
        return duplicateOf;
    }

    public void setDuplicateOf(String duplicateOf) {
        this.duplicateOf = duplicateOf;
    }
}
