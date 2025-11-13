import { db } from "../src/server/db";

async function wipeUsers() {
  try {
    console.log("Deleting all saved items...");
    const deletedSavedItems = await db.savedItem.deleteMany({});
    console.log(`Deleted ${deletedSavedItems.count} saved items`);

    console.log("Deleting all users...");
    const deletedUsers = await db.user.deleteMany({});
    console.log(`Deleted ${deletedUsers.count} users`);

    console.log("✅ User table wiped successfully!");
  } catch (error) {
    console.error("Error wiping users:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

wipeUsers();

