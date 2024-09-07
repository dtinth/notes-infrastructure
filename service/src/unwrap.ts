export function unwrap<T extends { data: any; error: any }>({
  data,
  error,
}: T): T['data'] {
  if (error) throw error
  return data
}
