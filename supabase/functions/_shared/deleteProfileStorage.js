// Discover all paths before removing anything so pagination offsets cannot
// skip files. Only Storage's actual ownership fields count, never user-supplied
// metadata or a filename that happens to contain the user's ID.
export async function ownedStoragePaths(storage, bucket, userId) {
  const paths = [];
  const folders = [''];
  for (let index = 0; index < folders.length; index++) {
    const folder = folders[index];
    for (let offset = 0; ; offset += 1000) {
      const {data, error} = await storage.from(bucket).list(folder, {limit:1000, offset, sortBy:{column:'name', order:'asc'}});
      if (error) throw error;
      for (const object of data || []) {
        const path = folder ? `${folder}/${object.name}` : object.name;
        if (!object.id) folders.push(path);
        else if ((object.owner_id || object.owner) === userId) paths.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return paths;
}
