const blogsRouter = require('express').Router()
const jwt = require('jsonwebtoken')
const Blog = require('../models/blog')
const User = require('../models/user')

blogsRouter.get('/', async (request, response) => {
  const blogs = await Blog.find({}).populate('user', { username: 1, name: 1 })
  response.json(blogs)
})

blogsRouter.post('/', async (request, response) => {
  const blog = new Blog(request.body)

  if (!request.token) {
    return response.status(401).json({ error: 'token missing' })
  }
  const decodedToken = jwt.verify(request.token, process.env.SECRET)
  if (!decodedToken.id) {
    //This will never be called jwt will throw a 500 jwt malformed error, token missing error is checked
    // before jwt.verify
    return response.status(401).json({ error: 'invalid token' })
  }
  if(!blog.title || !blog.url){
    return response.status(400).json({ error: 'url and title are required' })
  }
  const user = await User.findById(decodedToken.id)

  if(!blog.likes) {
    blog.likes = 0
  }

  blog.user = user

  const savedBlog = await blog.save()

  user.blogs = user.blogs.concat(savedBlog._id)
  await user.save()
  response.status(201).json(savedBlog)
})

blogsRouter.delete('/:id', async (request, response) => {
  const decodedToken = jwt.verify(request.token, process.env.SECRET)
  if (!request.token || !decodedToken.id) {
    return response.status(401).json({ error: 'token missing or invalid' })
  }
  const user = await User.findById(decodedToken.id)
  const blog = await Blog.findById(request.params.id)
  if (blog.user.toString() !== user.id.toString()) {
    return response.status(401).json({ error: 'only the creator can delete blogs' })
  }
  await Blog.findOneAndRemove({ _id: request.params.id, user: decodedToken.id })
  user.blogs = user.blogs.filter(b => b.id.toString() !== request.params.id.toString())
  await user.save()
  response.status(204).end()

})
blogsRouter.put('/:id', async (request, response) => {
  const updatedBlog = await Blog.findByIdAndUpdate(request.params.id,request.body,{ new: true })
  if(!updatedBlog){
    return response.status(404).end()
  }
  response.status(200).json(updatedBlog)
})
blogsRouter.post('/:id/comments', async (request, response) => {

  const blog = await Blog.findById(request.params.id)
  if(!blog){
    return response.status(404).end()
  }
  const { comment } = request.body
  blog.comments = [...blog.comments,{ text: comment }]
  const savedBlog = await blog.save()
  response.status(201).json(savedBlog)
})

module.exports = blogsRouter
