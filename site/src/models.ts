export type Catalog = CatalogItem[]

export interface CatalogItem {
    name: string;
    description: string;
    repository_url: string;
    branch: string;
}

export interface StartExecutionRequest {
    repository_url: string;
    branch: string | undefined;
    projectPath: string | undefined;
    project: string;
    stack: string;
    environments: string[];
}