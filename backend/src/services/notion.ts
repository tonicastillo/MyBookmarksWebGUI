import { Client } from '@notionhq/client'
import type { Bookmark, Category } from '../types/index.js'

const notion = new Client({
  auth: process.env.NOTION_API_KEY
})

const BOOKMARKS_DB_ID = process.env.NOTION_BOOKMARKS_DB_ID!
const CATEGORIES_DB_ID = process.env.NOTION_CATEGORIES_DB_ID!

/* eslint-disable @typescript-eslint/no-explicit-any */
type NotionProperty = any

const getTextContent = (property: NotionProperty): string => {
  if (property.type === 'title' && property.title.length > 0) {
    return property.title[0].plain_text
  }
  if (property.type === 'rich_text' && property.rich_text.length > 0) {
    return property.rich_text[0].plain_text
  }
  return ''
}

const getUrl = (property: NotionProperty): string => {
  if (property.type === 'url' && property.url) {
    return property.url
  }
  return ''
}

const getMultiSelect = (property: NotionProperty): string[] => {
  if (property.type === 'multi_select') {
    return property.multi_select.map((item: { name: string }) => item.name)
  }
  return []
}

const getSelect = (property: NotionProperty): string | undefined => {
  if (property.type === 'select' && property.select) {
    return property.select.name
  }
  return undefined
}

const getCheckbox = (property: NotionProperty): boolean => {
  if (property.type === 'checkbox') {
    return property.checkbox
  }
  return false
}

const getNumber = (property: NotionProperty): number => {
  if (property.type === 'number' && property.number !== null) {
    return property.number
  }
  return 0
}

const getRelation = (property: NotionProperty): string | undefined => {
  if (property.type === 'relation' && property.relation.length > 0) {
    return property.relation[0].id
  }
  return undefined
}

const getRelationIds = (property: NotionProperty): string[] => {
  if (property.type === 'relation') {
    return property.relation.map((r: { id: string }) => r.id)
  }
  return []
}

const getCreatedTime = (property: NotionProperty): string => {
  if (property.type === 'created_time') {
    return property.created_time
  }
  return ''
}

const getFormula = (property: NotionProperty): string => {
  if (property.type === 'formula' && property.formula.type === 'string' && property.formula.string) {
    return property.formula.string
  }
  return ''
}

const getFileUrl = (property: NotionProperty): string => {
  if (property.type === 'files' && property.files.length > 0) {
    const file = property.files[0]
    if (file.type === 'file') {
      return file.file.url
    }
    if (file.type === 'external') {
      return file.external.url
    }
  }
  return ''
}

export const fetchAllBookmarks = async (): Promise<Bookmark[]> => {
  const bookmarks: Bookmark[] = []
  let cursor: string | undefined = undefined

  do {
    const response = await notion.databases.query({
      database_id: BOOKMARKS_DB_ID,
      start_cursor: cursor,
      page_size: 100
    })

    for (const page of response.results) {
      if (!('properties' in page)) continue
      const props = page.properties

      const imageUrl = getUrl(props['imageUrlBase']) || getFormula(props['imageUrl']) || getFileUrl(props['image'])

      bookmarks.push({
        id: page.id,
        name: getTextContent(props['Name']),
        url: getUrl(props['URL']),
        alternateUrl: getUrl(props['AlternateURL']) || undefined,
        subtitle: getTextContent(props['Subtitle']) || undefined,
        tags: getMultiSelect(props['Tags']),
        categoryId: getRelation(props['Category']),
        visibleAtStart: getCheckbox(props['Visible at Start']),
        status: (getSelect(props['Status']) as Bookmark['status']) || 'Not started',
        valoration: getSelect(props['Valoration']) as Bookmark['valoration'],
        imageUrl: imageUrl || undefined,
        createdTime: getCreatedTime(props['Created time'])
      })
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return bookmarks
}

export const fetchAllCategories = async (): Promise<Category[]> => {
  const categories: Category[] = []
  let cursor: string | undefined = undefined

  do {
    const response = await notion.databases.query({
      database_id: CATEGORIES_DB_ID,
      start_cursor: cursor,
      page_size: 100
    })

    for (const page of response.results) {
      if (!('properties' in page)) continue
      const props = page.properties

      categories.push({
        id: page.id,
        name: getTextContent(props['Name']),
        order: getNumber(props['Order']),
        level: getNumber(props['Level']) || undefined,
        padreId: getRelation(props['Padre']),
        hijoIds: getRelationIds(props['Hijo'])
      })
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return categories.sort((a, b) => a.order - b.order)
}
