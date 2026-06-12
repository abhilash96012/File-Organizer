package com.fileorganizer.service;

import com.fileorganizer.model.FileRecord;
import com.fileorganizer.repository.CategoryRepository;
import com.fileorganizer.repository.FileRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class FileOrganizerServiceTest {

    @Autowired
    private FileOrganizerService fileOrganizerService;

    @Autowired
    private FileRecordRepository fileRecordRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Test
    public void testDuplicateDetection(@TempDir Path tempDir) throws IOException {
        // Create two duplicate files
        Path file1 = tempDir.resolve("doc1.txt");
        Path file2 = tempDir.resolve("doc1_copy.txt");

        String content = "Hello duplicate world!";
        Files.writeString(file1, content);
        Files.writeString(file2, content);

        // Seed categories if not already present
        if (categoryRepository.count() == 0) {
            fileOrganizerService.seedDefaultCategories();
        }

        // Organize the folder
        List<FileRecord> organized = fileOrganizerService.organizeLocalFolder(tempDir.toString());

        // Assertions
        assertEquals(2, organized.size());

        // Check database records
        List<FileRecord> dbRecords = fileRecordRepository.findAll();
        assertEquals(2, dbRecords.size());

        FileRecord docRecord = dbRecords.stream()
                .filter(r -> "doc1.txt".equals(r.getOriginalName()))
                .findFirst()
                .orElse(null);

        FileRecord copyRecord = dbRecords.stream()
                .filter(r -> "doc1_copy.txt".equals(r.getOriginalName()))
                .findFirst()
                .orElse(null);

        assertNotNull(docRecord);
        assertNotNull(copyRecord);

        assertEquals("Documents", docRecord.getCategory());
        assertEquals("Duplicates", copyRecord.getCategory());

        assertEquals(docRecord.getFilePath(), copyRecord.getDuplicateOf());
        assertEquals(docRecord.getHash(), copyRecord.getHash());
        assertFalse(docRecord.getHash().isEmpty());
    }
}
