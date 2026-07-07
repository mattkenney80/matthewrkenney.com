export interface Article {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  tags: string;
  date: string;
  body: string;
  published: number;
  created_at: string;
  updated_at: string;
}

export function articleTags(article: Pick<Article, 'tags'>): string[] {
  return article.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
