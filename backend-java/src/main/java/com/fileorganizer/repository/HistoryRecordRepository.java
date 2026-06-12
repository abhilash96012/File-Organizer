package com.fileorganizer.repository;

import com.fileorganizer.model.HistoryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HistoryRecordRepository extends JpaRepository<HistoryRecord, String> {
    Optional<HistoryRecord> findByFolderPath(String folderPath);
    List<HistoryRecord> findByIsAutoOrganizingTrue();
    List<HistoryRecord> findTop5ByOrderByLastOrganizedAtDesc();
}
