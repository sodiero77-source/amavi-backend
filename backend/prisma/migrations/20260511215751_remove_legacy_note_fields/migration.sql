/*
  Warnings:

  - You are about to drop the column `goal` on the `ClinicalNote` table. All the data in the column will be lost.
  - You are about to drop the column `objective` on the `ClinicalNote` table. All the data in the column will be lost.
  - You are about to drop the column `problem` on the `ClinicalNote` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClinicalNote" DROP COLUMN "goal",
DROP COLUMN "objective",
DROP COLUMN "problem";
