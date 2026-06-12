package com.fileorganizer.repository;

import com.fileorganizer.model.FileRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FileRecordRepository extends JpaRepository<FileRecord, String> {
    List<FileRecord> findAllByOrderByUploadDateDesc();
    List<FileRecord> findByHash(String hash);
    List<FileRecord> findByCategory(String category);
    void deleteByCategory(String category);
}
