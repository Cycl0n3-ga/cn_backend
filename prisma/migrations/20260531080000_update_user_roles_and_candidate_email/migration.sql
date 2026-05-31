PRAGMA foreign_keys=OFF;

-- Rebuild users so candidate accounts can omit email and the default role is CANDIDATE.
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_users" (
    "id",
    "username",
    "email",
    "passwordHash",
    "role",
    "solvedCount",
    "rating",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "username",
    "email",
    "passwordHash",
    CASE UPPER("role")
        WHEN 'ADMIN' THEN 'ADMIN'
        WHEN 'EXAMINER' THEN 'EXAMINER'
        WHEN 'QUESTIONER' THEN 'QUESTIONER'
        WHEN 'CANDIDATE' THEN 'CANDIDATE'
        WHEN 'USER' THEN 'CANDIDATE'
        ELSE 'CANDIDATE'
    END,
    "solvedCount",
    "rating",
    "createdAt",
    "updatedAt"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
