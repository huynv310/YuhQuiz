-- Nâng giới hạn dung lượng file trong bucket exam-pdfs lên 100MB/đề (trước đó không giới hạn
-- ở tầng Storage, chỉ chặn ở client 15MB). Client (CreateExamModal.tsx) đã đổi ngưỡng tương ứng.
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'exam-pdfs';
