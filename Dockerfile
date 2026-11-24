FROM rust:1.83-slim-bookworm AS builder
WORKDIR /app
COPY . .
WORKDIR /app/rust-studio
RUN cargo build --release --bin xiangqi_studio

FROM debian:bookworm-slim
RUN useradd -m -u 1000 appuser
WORKDIR /app
COPY --from=builder /app/rust-studio/target/release/xiangqi_studio /usr/local/bin/xiangqi_studio
USER appuser
ENV PORT=8124
EXPOSE 8124
CMD ["xiangqi_studio", "--host", "0.0.0.0", "--public"]
