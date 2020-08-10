const blogsRouter = require('express').Router()
const jwt = require('jsonwebtoken')
const Blog = require('../models/blog')
const User = require('../models/user')

blogsRouter.get('/', async (request, response) => {
  const blogs = await Blog.find({}).populate('user', { username: 1, name: 1 })
  response.json(blogs)
})

blogsRouter.post('/', async (request, response) => {
  const body = request.body

  // If title and url are both missing a bad request error is sent
  if(!body.title && !body.url){
    return response.status(400).json({ error: 'url and title are missing' })
  }
  if (!request.token) {
    return response.status(401).json({ error: 'token missing' })
  }
  const decodedToken = jwt.verify(request.token, process.env.SECRET)
  if (!decodedToken.id) {
    //This will never be called jwt will throw a 500 jwt malformed error, token missing error is checked
    // before jwt.verify
    return response.status(401).json({ error: 'invalid token' })
  }
  const user = await User.findById(decodedToken.id)

  const blog = new Blog({
    title: body.title,
    author: body.author,
    url: body.url,
    likes: body.likes || 0,
    user: user._id
  })

  const savedBlog = await blog.save()
  response.status(201).json(savedBlog)
})

blogsRouter.delete('/:id', async (request, response) => {
  const decodedToken = jwt.verify(request.token, process.env.SECRET)
  if (!request.token || !decodedToken.id) {
    return response.status(401).json({ error: 'token missing or invalid' })
  }
  const deletedBlog = await Blog.findOneAndRemove({ _id: request.params.id, user: decodedToken.id })
  if(deletedBlog){
    response.status(204).end()
  }else {
    response.status(400).json({ error: 'no such blog entry for this user' })
  }
})

blogsRouter.patch('/:id', async (request, response) => {
  const updatedBlog = await Blog.findByIdAndUpdate(request.params.id,request.body,{ new: true })
  response.status(200).json(updatedBlog)
})

module.exports = blogsRouter
