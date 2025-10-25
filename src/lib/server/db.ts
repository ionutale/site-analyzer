import { MongoClient } from 'mongodb';
import type { Db, Collection, Document } from 'mongodb';
import { env } from '$env/dynamic/private';

let clientPromise: Promise<MongoClient> | null = null;
let dbInstance: Db | null = null;
let indexesEnsured = false;

const getMongoUri = (): string => {
	const uri = env.MONGODB_URI || 'mongodb://localhost:27017';
	return uri;
};

const getDbName = (): string => {
	return env.MONGODB_DB || 'sv-app';
};

export async function getClient(): Promise<MongoClient> {
	if (!clientPromise) {
		const client = new MongoClient(getMongoUri());
		clientPromise = client.connect();
	}
	return clientPromise;
}

export async function getDb(): Promise<Db> {
	if (!dbInstance) {
		const client = await getClient();
		dbInstance = client.db(getDbName());
		await ensureIndexes(dbInstance);
	}
	return dbInstance;
}

export interface LinkDoc extends Document {
	siteId: string;
	url: string;
	status: 'pending' | 'in_progress' | 'done' | 'error';
	attempts: number;
	lastError?: string | null;
	leasedAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
	depth?: number | null;
}

export interface PageDoc extends Document {
	siteId: string;
	url: string;
	statusCode?: number | null;
	fetchedAt: Date;
	contentType?: string | null;
	title?: string | null;
	titleLength?: number | null;
	meta?: Record<string, string> | null;
	metaDescription?: string | null;
	loadTimeMs?: number | null;
	canonicalUrl?: string | null;
	content: string; // HTML or text
	textContent?: string | null; // extracted text only
	textExcerpt?: string;
	contentHash?: string;
	screenshotPath?: string | null;
	contentLength?: number | null; // characters in content
	wordCount?: number | null;
}

export async function links(): Promise<Collection<LinkDoc>> {
	const db = await getDb();
	return db.collection<LinkDoc>('links');
}

export async function pages(): Promise<Collection<PageDoc>> {
	const db = await getDb();
	return db.collection<PageDoc>('pages');
}

async function ensureIndexes(db: Db): Promise<void> {
	if (indexesEnsured) return;
	await db
		.collection<LinkDoc>('links')
		.createIndexes([
			{ key: { siteId: 1, url: 1 }, unique: true },
			{ key: { status: 1 } },
			{ key: { siteId: 1, status: 1 } }
		]);

	await db
		.collection<PageDoc>('pages')
		.createIndexes([{ key: { siteId: 1, url: 1 }, unique: true }, { key: { fetchedAt: -1 } }]);
	indexesEnsured = true;
}
