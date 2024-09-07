export interface Note {
  id: string
  topic: boolean
  version: string
  text: string
  links: string
  aka: string
  excerpt: string
  title: string
  public: boolean
  names: string
  frontMatter: Record<string, any>
}
