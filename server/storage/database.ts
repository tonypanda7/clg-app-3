// SQLite Database Setup (requires sqlite3 package)
// Run: npm install sqlite3 @types/sqlite3

import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

interface User {
  id: string;
  fullName: string;
  universityEmail: string;
  password: string;
  phoneNumber?: string;
  universityName?: string;
  universityId?: string;
  program?: string;
  yearOfStudy?: string;
  createdAt: Date;
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  collegeData?: {
    department: string;
    courses: string[];
    academicYear: string;
    semester: string;
    advisor?: string;
    gpa?: number;
  };
}

const DB_PATH = path.join(process.cwd(), 'data', 'users.db');

class Database {
  private db: any;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Don't initialize in constructor, do it lazily
  }

  private async ensureDataDirectory() {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private async initializeDatabase() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize() {
    try {
      await this.ensureDataDirectory();
      
      const sqlite3 = await import('sqlite3');
      this.db = new sqlite3.default.Database(DB_PATH, (err) => {
        if (err) {
          console.error('SQLite connection error:', err);
          throw err;
        }
      });

      const run = promisify(this.db.run.bind(this.db));

      // Create users table if it doesn't exist
      await run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          fullName TEXT NOT NULL,
          universityEmail TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          phoneNumber TEXT,
          universityName TEXT,
          universityId TEXT,
          program TEXT,
          yearOfStudy TEXT,
          isEmailVerified BOOLEAN DEFAULT 0,
          verificationToken TEXT,
          verificationTokenExpiry DATETIME,
          collegeData TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add new columns to existing tables (migration)
      try {
        await run(`ALTER TABLE users ADD COLUMN isEmailVerified BOOLEAN DEFAULT 0`);
      } catch (e) { /* Column already exists */ }
      
      try {
        await run(`ALTER TABLE users ADD COLUMN verificationToken TEXT`);
      } catch (e) { /* Column already exists */ }
      
      try {
        await run(`ALTER TABLE users ADD COLUMN verificationTokenExpiry DATETIME`);
      } catch (e) { /* Column already exists */ }
      
      try {
        await run(`ALTER TABLE users ADD COLUMN collegeData TEXT`);
      } catch (e) { /* Column already exists */ }

      this.initialized = true;
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw new Error('SQLite3 package not installed or database initialization failed. Run: npm install sqlite3 @types/sqlite3');
    }
  }

  async addUser(user: User): Promise<void> {
    await this.initializeDatabase();
    const run = promisify(this.db.run.bind(this.db));
    
    await run(`
      INSERT INTO users (
        id, fullName, universityEmail, password, phoneNumber,
        universityName, universityId, program, yearOfStudy, isEmailVerified,
        verificationToken, verificationTokenExpiry, collegeData, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id, user.fullName, user.universityEmail, user.password,
      user.phoneNumber, user.universityName, user.universityId,
      user.program, user.yearOfStudy, user.isEmailVerified,
      user.verificationToken, 
      user.verificationTokenExpiry?.toISOString(),
      user.collegeData ? JSON.stringify(user.collegeData) : null,
      user.createdAt.toISOString()
    ]);
  }

  async findUser(emailOrUsername: string): Promise<User | undefined> {
    await this.initializeDatabase();
    const get = promisify(this.db.get.bind(this.db));
    
    const row = await get(`
      SELECT * FROM users 
      WHERE universityEmail = ? OR LOWER(fullName) = LOWER(?)
    `, [emailOrUsername, emailOrUsername]);

    return row ? this.rowToUser(row) : undefined;
  }

  async findUserById(id: string): Promise<User | undefined> {
    await this.initializeDatabase();
    const get = promisify(this.db.get.bind(this.db));
    
    const row = await get(`SELECT * FROM users WHERE id = ?`, [id]);
    return row ? this.rowToUser(row) : undefined;
  }

  async findUserByVerificationToken(token: string): Promise<User | undefined> {
    await this.initializeDatabase();
    const get = promisify(this.db.get.bind(this.db));
    
    const row = await get(`
      SELECT * FROM users WHERE verificationToken = ?
    `, [token]);

    return row ? this.rowToUser(row) : undefined;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    await this.initializeDatabase();
    const run = promisify(this.db.run.bind(this.db));
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'collegeData' && value) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'verificationTokenExpiry' && value) {
        fields.push(`${key} = ?`);
        values.push(value.toISOString());
      } else if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length > 0) {
      values.push(id);
      await run(`
        UPDATE users SET ${fields.join(', ')} WHERE id = ?
      `, values);
    }
  }

  async emailExists(email: string): Promise<boolean> {
    await this.initializeDatabase();
    const get = promisify(this.db.get.bind(this.db));
    
    const row = await get(`
      SELECT COUNT(*) as count FROM users WHERE universityEmail = ?
    `, [email]);

    return row.count > 0;
  }

  async getAllUsers(): Promise<User[]> {
    await this.initializeDatabase();
    const all = promisify(this.db.all.bind(this.db));

    const rows = await all(`SELECT * FROM users ORDER BY createdAt DESC`);
    return rows.map(row => this.rowToUser(row));
  }

  async clearAllUsers(): Promise<void> {
    await this.initializeDatabase();
    const run = promisify(this.db.run.bind(this.db));

    await run(`DELETE FROM users`);
    console.log('All users cleared from database');
  }

  private rowToUser(row: any): User {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      isEmailVerified: Boolean(row.isEmailVerified),
      verificationTokenExpiry: row.verificationTokenExpiry ? new Date(row.verificationTokenExpiry) : undefined,
      collegeData: row.collegeData ? JSON.parse(row.collegeData) : undefined
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

export { Database, User };
