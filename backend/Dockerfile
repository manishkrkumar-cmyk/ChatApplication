# ==========================================
# STAGE 1: Build the Application
# ==========================================
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy pom.xml and download dependencies first (leveraging Docker layer caching)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build the executable JAR
COPY src ./src
RUN mvn clean package -DskipTests

# ==========================================
# STAGE 2: Run the Application
# ==========================================
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copy the generated jar from the build stage
COPY --from=build /app/target/*.jar app.jar

# Expose the server port
EXPOSE 8081

# Command to run the application using dynamic PORT environment variable (ideal for Render/Cloud hosting)
CMD ["sh", "-c", "java -jar app.jar --server.port=${PORT:-8081}"]