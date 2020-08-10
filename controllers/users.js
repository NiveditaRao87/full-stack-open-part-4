const bcrypt = require('bcrypt')
const usersRouter = require('express').Router()
const User = require('../models/user')
const Blog = require('../models/blog')

usersRouter.post('/', async (request, response) => {
  const body = request.body
  let error
  body.password ?
    body.password.length >= 3 ?
      error = null
      :error = 'password must have atleast 3 characters'
    :error = 'password missing'
  if(error){
    console.log(error)
    return response.status(400).json({ error })
  }
  const saltRounds = 10
  const passwordHash = await bcrypt.hash(body.password, saltRounds)

  const user = new User({
    username: body.username,
    name: body.name,
    passwordHash,
  })

  const savedUser = await user.save()

  response.json(savedUser)
})

usersRouter.get('/', async (request, response) => {
  // Since users document does not contain a field to hold blog ids, populate cannot be used, the data needs to be
  // transformed before sending but a mongoose document's fields cannot be modified.
  // Adding lean converts the mongoose document to a js object. Lean can be used here as doc is not modified,
  // but should not be used in post, put, patch where the doc may be modified.
  const users = await User.find({}).lean()
  const allBlogs = await Blog.find({}).lean()

  users.forEach(u => u.blogs =
    allBlogs.filter( blog => blog.user.toString() === u._id.toString()))
  users.forEach(user => user.blogs.forEach(blog => {
    delete blog.user
    delete blog.__v
    blog.id = blog._id.toString()
    delete blog._id
  }))
  response.json(users)
})

module.exports = usersRouter