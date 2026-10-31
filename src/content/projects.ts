export interface Project {
  title: string;
  description: string;
  year: string;
  status: 'active' | 'archived' | 'experiment' | 'planned';
  stack: string[];
  link?: string;
  repo?: string;
  featured?: boolean;
  order?: number;
}

/**
 * Mission files live here until a project needs a full write-up.
 * Add an object to publish a card on the home page and /projects/.
 * Keep the shape identical so the card component stays dumb.
 */
export const projects: Project[] = [];
