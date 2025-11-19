import { MongoClient } from 'mongodb';
import type { Db, Collection, Document } from 'mongodb';

let clientPromise: Promise<MongoClient> | null = null;
let dbInstance: Db | null = null;
let indexesEnsured = false;

const getMongoUri = (): string => {
	return process.env.MONGODB_URI || 'mongodb://localhost:27017';
};

const getDbName = (): string => {
	return process.env.MONGODB_DB || 'sv-app';
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
    ingestId?: string | null;
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
    ingestId?: string | null; // uid of the refetch/ingestion session
    ingestedAt?: Date | null; // when this page content was ingested
	// Accessibility quick metrics
	a11y?: {
 		imagesMissingAlt?: number;
		imagesMissingAltUrls?: string[]; // New: list of images missing alt text
 		anchorsWithoutText?: number;
 		h1Count?: number;
 	};

	// SEO & Content Analysis
	seo?: {
		hTags?: {
			h1: number;
			h2: number;
			h3: number;
			h4: number;
			h5: number;
			h6: number;
		};
		structureIssues?: string[]; // e.g. "Missing H1", "Multiple H1", "Skipped heading level"
		metaDescriptionLength?: number;
		metaDescriptionIssues?: string[]; // e.g. "Too short", "Too long", "Missing"
		structuredData?: boolean; // true if JSON-LD is present
	};

	outgoingLinks?: string[]; // List of absolute URLs linked from this page

	// Performance / Lighthouse
	performance?: {
		score?: number; // 0-100
		fcp?: number; // First Contentful Paint (ms)
		lcp?: number; // Largest Contentful Paint (ms)
		cls?: number; // Cumulative Layout Shift
		speedIndex?: number;
		auditedAt?: Date;
	};

 	// Images metadata (lightweight)
 	imagesMeta?: {
 		total?: number;
 		counts?: {
 			avif?: number; webp?: number; jpeg?: number; jpg?: number; png?: number; gif?: number; svg?: number; other?: number;
 		};
 		largeDimensions?: number; // images with large pixel area or width/height over threshold
 		sampleLarge?: string[]; // a few example URLs
 	};
}

export interface SiteDoc extends Document {
	siteId: string; // unique index
	createdAt: Date;
	schedule?: 'manual' | 'daily' | 'weekly' | 'monthly';
	lastScheduledRun?: Date;
}

export async function links(): Promise<Collection<LinkDoc>> {
	const db = await getDb();
	return db.collection<LinkDoc>('links');
}

export async function pages(): Promise<Collection<PageDoc>> {
	const db = await getDb();
	return db.collection<PageDoc>('pages');
}

export async function sites(): Promise<Collection<SiteDoc>> {
	const db = await getDb();
	return db.collection<SiteDoc>('sites');
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

	await db.collection<PageDoc>('pages').createIndexes([
		{ key: { siteId: 1, url: 1 }, unique: true },
		{ key: { fetchedAt: -1 } },
		{
			key: { siteId: 1, contentHash: 1 },
			name: 'by_site_contentHash',
			partialFilterExpression: { contentHash: { $exists: true } }
		}
	]);

	await db.collection<SiteDoc>('sites').createIndex({ siteId: 1 }, { unique: true });

	indexesEnsured = true;
}
