import { users } from './../db/schema'

export const getAllUsers = async (db: any) => {
	return db.select().from(users)
}
