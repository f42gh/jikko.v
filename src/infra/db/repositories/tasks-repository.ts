import { db } from "../client";
import { tasks } from "../schema";

export const tasksRepository = {
  list() {
    return db.select().from(tasks);
  },
};
