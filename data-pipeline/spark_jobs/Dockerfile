FROM bitnami/spark:3.5

USER root

# Download S3A connector JARs so Spark can talk to MinIO (S3-compatible)
# hadoop-aws version must match the Hadoop bundled in bitnami/spark:3.5 (Hadoop 3.3.x)
ARG HADOOP_AWS_VERSION=3.3.4
ARG AWS_SDK_VERSION=1.12.670
ARG JARS_DIR=/opt/bitnami/spark/jars

RUN curl -fsSL \
    "https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/${HADOOP_AWS_VERSION}/hadoop-aws-${HADOOP_AWS_VERSION}.jar" \
    -o "${JARS_DIR}/hadoop-aws-${HADOOP_AWS_VERSION}.jar" && \
    curl -fsSL \
    "https://repo1.maven.org/maven2/com/amazonaws/aws-java-sdk-bundle/${AWS_SDK_VERSION}/aws-java-sdk-bundle-${AWS_SDK_VERSION}.jar" \
    -o "${JARS_DIR}/aws-java-sdk-bundle-${AWS_SDK_VERSION}.jar"

# Install Python dependencies for Spark jobs
COPY requirements-spark.txt /tmp/requirements-spark.txt
RUN pip install --no-cache-dir -r /tmp/requirements-spark.txt

USER 1001

WORKDIR /opt/spark-jobs
COPY . /opt/spark-jobs/
