import postgres from "postgres";

/**
 * How many stored messages carry this subject, read straight from the suite's
 * database (CI: a fresh Postgres; locally: DATABASE_URL, never the real one).
 */
export async function countContactMessages(subject: string): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("The contact tests read DATABASE_URL to check storage.");
  }
  const sql = postgres(url, { max: 1 });
  try {
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from contact_messages where subject = ${subject}
    `;
    return row?.count ?? 0;
  } finally {
    await sql.end();
  }
}
