const mongoose = require('mongoose')
const helper = require('./test_helper')
const supertest = require('supertest')
const app = require('../app')
const api = supertest(app)
const bcrypt = require('bcrypt')
const Blog = require('../models/blog')
const User = require('../models/user')

beforeEach(async () => {
  await Blog.deleteMany({})

  for(let blog of helper.initialBlogs) {
    let blogObject = new Blog(blog)
    await blogObject.save()
  }
})

afterAll(() => {
  mongoose.connection.close()
})

const login = async () => {
  await User.deleteMany({})

  const { id, username, password } = await helper.createUser()

  const response = await api
    .post('/api/login')
    .send({ username, password })
    .expect(200)

  const token = `bearer ${response.body.token}`

  return { token, id }
}

describe('when there is initially some blogs saved', () => {

  test('blogs are returned as json', async () => {
    await api
      .get('/api/blogs')
      .expect(200)
      .expect('Content-Type', /application\/json/)
  })

  test('all blogs are returned', async () => {
    const response = await api.get('/api/blogs')

    expect(response.body).toHaveLength(helper.initialBlogs.length)
  })

  test('a blog has a property id', async () => {
    const response = await api.get('/api/blogs')
    expect(response.body[0].id).toBeDefined()

  })
})

describe('creation of a new blog entry', () => {

  test('a blog is created correctly in the database', async() => {

    const { token, id } = await login()

    const newBlog = {
      title: 'Canonical string reduction',
      author: 'Edsger W. Dijkstra',
      url: 'http://www.cs.utexas.edu/~EWD/transcriptions/EWD08xx/EWD808.html',
      likes: 12
    }
    await api
      .post('/api/blogs')
      .send(newBlog)
      .set('Authorization', token)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    const blogsAtEnd = await helper.blogsInDb()
    expect(blogsAtEnd).toHaveLength(helper.initialBlogs.length + 1)
    expect(blogsAtEnd.map(blog => blog.title)).toContain('Canonical string reduction')
    const addedBlog = blogsAtEnd.find(blog => blog.title === 'Canonical string reduction')
    expect(addedBlog.author).toBe('Edsger W. Dijkstra')
    expect(addedBlog.url).toBe('http://www.cs.utexas.edu/~EWD/transcriptions/EWD08xx/EWD808.html')
    expect(addedBlog.likes).toBe(12)
    expect(addedBlog.user.toString()).toBe(id.toString())
  })

  test('blog is created with 0 likes if likes property is missing', async () => {

    const { token } = await login()

    const newBlog = {
      title: 'First class tests',
      author: 'Robert C. Martin',
      url: 'http://blog.cleancoder.com/uncle-bob/2017/05/05/TestDefinitions.htmll'
    }
    await api
      .post('/api/blogs')
      .send(newBlog)
      .set('Authorization', token)
      .expect(201)

    const blogsAtEnd = await helper.blogsInDb()
    expect(blogsAtEnd).toHaveLength(helper.initialBlogs.length + 1)
    const addedBlog = blogsAtEnd.find(blog => blog.title === 'First class tests')
    expect(addedBlog.likes).toBe(0)
  })

  test('fails with status code 400 if title and url are missing', async () => {

    const { token } = await login()

    const newBlog = {
      author: 'Anonymous',
      likes: 3939393,
      title: 'Url is missing'
    }

    const response = await api
      .post('/api/blogs')
      .send(newBlog)
      .set('Authorization', token)
      .expect(400)

    expect(response.body.error).toContain('url and title are required')

  })
  test('fails with status 401 if token is missing', async () => {

    const newBlog = {
      author: 'Anonymous',
      likes: 3939393,
      title: 'title or url should be present'
    }

    const response = await api
      .post('/api/blogs')
      .send(newBlog)
      .set('Authorization', 'bearer ')
      .expect(401)

    expect(response.body.error).toContain('token missing')
  })

})

describe('updating likes of a specific blog', () => {
  test('succeeds with a valid id', async () => {
    const blogsAtStart = await helper.blogsInDb()

    const blogToUpdate = blogsAtStart[0]

    blogToUpdate.likes = blogToUpdate.likes + 1

    await api
      .put(`/api/blogs/${blogToUpdate.id}`)
      .send(blogToUpdate)
      .expect(200)

    const blogsAtEnd = await helper.blogsInDb()
    expect(blogsAtEnd.length).toBe(blogsAtStart.length)
    expect(blogsAtEnd.find(blog => blog.id === blogToUpdate.id)).toEqual(blogToUpdate)
  })

  test('fails with statuscode 404 if blog does not exist', async () => {
    const validNonexistingId = await helper.nonExistingId()

    await api
      .put(`/api/blogs/${validNonexistingId}`)
      .expect(404)
  })

})

describe('adding comments to a blog', () => {
  test('succeeds with status 201 when blog exists', async () => {
    const blogsAtStart = await helper.blogsInDb()

    const blogToUpdate = blogsAtStart[0]

    blogToUpdate.comment = 'This is a new comment to test adding comments'

    await api
      .post(`/api/blogs/${blogToUpdate.id}/comments`)
      .send(blogToUpdate)
      .expect(201)

    const blogsAtEnd = await helper.blogsInDb()
    const comments = blogsAtEnd.find(b => b.id === blogToUpdate.id).comments.map(c => c.text)
    expect(blogsAtEnd.length).toBe(blogsAtStart.length)
    expect(comments).toContain('This is a new comment to test adding comments')
  })
  test('fails with statuscode 404 if blog does not exist', async () => {
    const validNonexistingId = await helper.nonExistingId()

    const blogsAtStart = await helper.blogsInDb()
    const blogToUpdate = blogsAtStart[0]

    blogToUpdate.comment = 'This is a new comment to test adding comments'

    await api
      .post(`/api/blogs/${validNonexistingId}/comments`)
      .send(blogToUpdate)
      .expect(404)
  })
})

describe('deletion of a blog', () => {
  test('succeeds with status code 204 if id is valid', async () => {

    const { token, id } = await login()

    const blogToDelete = new Blog({
      title: 'This blog is created here to add the user id',
      author: 'Me myself',
      url: 'www.wontfinditanywherecauseitsrubbish.com',
      user: id
    })

    await blogToDelete.save()

    const blogsAtStart = await helper.blogsInDb()

    await api
      .delete(`/api/blogs/${blogToDelete.id}`)
      .set('Authorization', token)
      .expect(204)

    const blogsAtEnd = await helper.blogsInDb()

    expect(blogsAtEnd).toHaveLength(
      blogsAtStart.length - 1
    )

    const titles = blogsAtEnd.map(r => r.title)

    expect(titles).not.toContain(blogToDelete.title)
  })
})

describe('when there is initially one user in db', () => {
  beforeEach(async () => {
    await User.deleteMany({})

    const passwordHash = await bcrypt.hash('shhhhh', 10)
    const user = new User({ username: 'root', passwordHash })

    await user.save()
  })

  test('creation succeeds with a fresh valid username', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'nroar',
      name: 'Nivedita R Rao',
      password: 'secret',
    }

    await api
      .post('/api/users')
      .send(newUser)
      .expect(200)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length + 1)

    const usernames = usersAtEnd.map(u => u.username)
    expect(usernames).toContain(newUser.username)
  })
  test('creation fails with proper statuscode and message if username already taken', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'root',
      name: 'Superuser',
      password: 'something',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    expect(result.body.error).toContain('`username` to be unique')

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length)
  })
  test('creation fails with proper statuscode and message if username is missing', async () => {
    const usersAtStart = await helper.usersInDb()
    const newUser = {
      name: 'Anonymous',
      password: 'missing',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    expect(result.body.error).toContain('`username` is required.')

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length)
  })
  test('creation fails with proper statuscode and message if username is less than 3 characters', async () => {
    const usersAtStart = await helper.usersInDb()
    const newUser = {
      username: 'pi',
      name: 'Constant',
      password: '3d14',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    expect(result.body.error).toContain('is shorter than the minimum allowed length')
    expect(result.body.error).toContain('username')

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length)
  })
  test('creation fails with proper statuscode and message if password is missing', async () => {
    const usersAtStart = await helper.usersInDb()
    const newUser = {
      username: 'Forgot',
      name: 'Password',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    expect(result.body.error).toContain('password missing')

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length)
  })
  test('creation fails with proper statuscode and message if password is less than 3 characters', async () => {
    const usersAtStart = await helper.usersInDb()
    const newUser = {
      username: 'Short',
      name: 'Short Hand',
      password: 'pw',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    expect(result.body.error).toContain('password must have atleast 3 characters')

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length)
  })
})

