export const CHARACTER_LIMIT = 25000;
export const DEFAULT_LIMIT = 20;
export const DEFAULT_OFFSET = 0;
export const DEFAULT_TTL_SECONDS = 3600;
export const API_TIMEOUT = 30000;

export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json'
}

export enum ProjectStatus {
  ALL = 'all',
  ACTIVE = 'active',
  CLOSED = 'closed'
}

export enum BugStatus {
  ALL = 'all',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum Severity {
  CRITICAL = '1',
  SERIOUS = '2',
  NORMAL = '3',
  MINOR = '4'
}

export enum Priority {
  HIGH = '1',
  MEDIUM = '2',
  LOW = '3',
  LOWEST = '4'
}

export enum OrderBy {
  ID_DESC = 'id_desc',
  ID_ASC = 'id_asc',
  OPENED_DATE_DESC = 'openedDate_desc',
  OPENED_DATE_ASC = 'openedDate_asc',
  SEVERITY_DESC = 'severity_desc',
  SEVERITY_ASC = 'severity_asc'
}
