-- Allow designated users to create requests for others
ALTER TABLE USERS
ADD COLUMN can_create_request_for_others INTEGER NOT NULL DEFAULT 0
CHECK (can_create_request_for_others IN (0, 1));

-- Record who actually submitted each request
ALTER TABLE LEAVE_REQUESTS
ADD COLUMN created_by_user_id INTEGER REFERENCES USERS(id);

-- Historical requests were created before delegation existed
UPDATE LEAVE_REQUESTS
SET created_by_user_id = user_id
WHERE created_by_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_created_by
ON LEAVE_REQUESTS(created_by_user_id);