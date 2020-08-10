const _ = require('lodash')

const dummy = (blogs) => {
  return 1 || blogs // || blogs is to remove linter error
}

const totalLikes = (blogs) => {

  return blogs.count === 0
    ? 0
    : blogs.reduce((total,blog) => total + blog.likes,0)
}

const favouriteBlog = (blogs) => {

  if(blogs.length === 0){
    return 'blog list is empty'
  }
  const max = blogs.reduce((a,b) => Math.max(a,b.likes),0)
  const { title,author,likes }  = blogs.find(blog => blog.likes === max)
  return { title,author,likes }

}

const mostBlogs = (bloglist) => {

  if(bloglist.length === 0){
    return 'blog list is empty'
  }
  const authorAndBlogCount = _.countBy(bloglist,_.property('author'))
  const blogs = _.reduce(authorAndBlogCount,(a,b) => Math.max(a,b))
  const author = _.findKey(authorAndBlogCount,(blogCount) => blogCount === blogs)
  return { author,blogs }

}

const mostLikes = (blogList) => {

  if(blogList.length === 0){
    return 'blog list is empty'
  }
  const groupedByAuthor = _.groupBy(blogList,_.property('author'))
  const authorAndLikes = _.mapValues(groupedByAuthor,(authorBlogs) => authorBlogs.reduce((a,b) => a + b.likes,0))
  const likes = _.reduce(authorAndLikes,(a,b) => Math.max(a,b))
  const author = _.findKey(authorAndLikes,(l) => l === likes)
  return { author, likes }
}

module.exports = {
  dummy,
  totalLikes,
  favouriteBlog,
  mostBlogs,
  mostLikes
}

