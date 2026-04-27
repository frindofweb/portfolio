# Use the official Node.js image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=80

# Expose the port the app runs on
EXPOSE 80

# Command to run the application
CMD ["npm", "start"]
